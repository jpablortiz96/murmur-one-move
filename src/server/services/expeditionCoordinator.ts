import { randomUUID } from 'node:crypto';
import type { RedisClient } from '@devvit/web/server';
import type { JsonObject } from '@devvit/shared';
import { WORLD_GENERATOR_VERSION } from '../../shared/constants/game';
import type { ExpeditionPublicView } from '../../shared/contracts/expedition';
import type { ResolveRoundResponse, RoundStateResponse } from '../../shared/contracts/round';
import { applyConsequence, endingForState } from '../game/expedition/consequenceEngine';
import { createChapterPostSpec, createResolvedFallback, type ChapterPostSpec } from '../game/expedition/chapterPosts';
import { getChapter } from '../game/expedition/chapters';
import { computeBranchHash, createScenarioIdentityV2 } from '../game/expedition/branching';
import { createExpedition, type CreateExpeditionInput } from '../game/expedition/createExpedition';
import type { ExpeditionState } from '../game/expedition/expeditionTypes';
import { transitionExpedition } from '../game/expedition/stateMachine';
import { createRoundWindow, type WindowProfile } from '../game/expedition/windows';
import { generateScenarioV2 } from '../game/world/generateScenarioV2';
import { createExpeditionKeys } from './expeditionKeys';
import { ExpeditionRepository } from './expeditionRepository';

type CoordinatorRedis = Pick<RedisClient, 'get' | 'set' | 'del'>;

export type ChapterPostGateway = {
  find(seasonId: string, day: number, subredditName: string): Promise<string | null>;
  create(spec: ChapterPostSpec): Promise<string>;
  updateFallback(postId: string, text: string): Promise<void>;
};

export type ExpeditionScheduler = {
  schedule(name: 'resolve-round' | 'publish-next-chapter', data: JsonObject, runAt: Date): Promise<string>;
};

export type ExpeditionRoundGateway = {
  get(subredditId: string, postId: string, day: number): Promise<RoundStateResponse>;
  resolve(subredditId: string, postId: string, day: number): Promise<ResolveRoundResponse>;
};

export type StartExpeditionInput = Omit<CreateExpeditionInput, 'windowProfile'> & {
  operationId: string;
};

export class ExpeditionCoordinatorError extends Error {
  readonly code: 'not-found' | 'window-open' | 'invalid-state' | 'busy' | 'no-signals';
  constructor(code: ExpeditionCoordinatorError['code'], message: string) {
    super(message);
    this.name = 'ExpeditionCoordinatorError';
    this.code = code;
  }
}

export class ExpeditionCoordinator {
  constructor(
    private readonly redis: CoordinatorRedis,
    private readonly repository: ExpeditionRepository,
    private readonly posts: ChapterPostGateway,
    private readonly jobs: ExpeditionScheduler,
    private readonly rounds: ExpeditionRoundGateway,
    private readonly windowProfile: WindowProfile,
    private readonly now: () => Date = () => new Date()
  ) {}

  async getActive(subredditId: string): Promise<ExpeditionState | null> {
    return await this.repository.getActive(subredditId);
  }

  async start(input: StartExpeditionInput): Promise<ExpeditionState> {
    const initial = createExpedition({ ...input, windowProfile: this.windowProfile });
    const { state } = await this.repository.create(initial);
    return await this.publishDay(state.subredditId, state.seasonId, 1, `${input.operationId}:day-1`);
  }

  async closeRound(subredditId: string, seasonId: string, operationId: string): Promise<ExpeditionState> {
    const timestamp = this.now().toISOString();
    return await this.repository.update(subredditId, seasonId, (state) => {
      if (state.status !== 'open') return state;
      if (Date.parse(state.window.closesAt) <= Date.parse(timestamp)) return state;
      return {
        ...state,
        window: { ...state.window, closesAt: timestamp, revealAt: timestamp, nextChapterAt: timestamp },
        updatedAt: timestamp,
        revision: state.revision + 1,
        transitions: [...state.transitions, {
          from: 'open', to: 'open', previousRevision: state.revision, nextRevision: state.revision + 1,
          at: timestamp, cause: 'moderator-close-window', operationId,
          auditHash: computeBranchHash(state.seasonId, state.history),
        }],
      };
    });
  }

  async resolve(input: {
    subredditId: string;
    seasonId: string;
    day: number;
    operationId: string;
    force?: boolean;
  }): Promise<ExpeditionState> {
    const keys = createExpeditionKeys(input.subredditId, input.seasonId);
    return await this.withLease(keys.resolveLease(input.day), async () => {
      let state = await this.requireState(input.subredditId, input.seasonId);
      const existing = state.history.find((summary) => summary.day === input.day);
      if (existing) return state;
      if (state.currentDay !== input.day) throw new ExpeditionCoordinatorError('invalid-state', 'Job targets a stale expedition day');
      if (!input.force && this.now().getTime() < Date.parse(state.window.closesAt)) {
        throw new ExpeditionCoordinatorError('window-open', 'Round window has not closed yet');
      }
      if (!state.currentPostId) throw new ExpeditionCoordinatorError('invalid-state', 'Current chapter has no post');
      const currentPostId = state.currentPostId;
      // Zero-signal policy: a round nobody voted in has no community direction.
      // Every direction would tie at zero and the tie-break would invent a
      // winner, so a scheduled resolution keeps the hollow open and waiting for
      // the first signal, and a manual resolution is refused outright.
      const round = await this.rounds.get(state.subredditId, currentPostId, input.day);
      if (round.counts.total === 0 && !round.resolution) {
        if (input.force) {
          throw new ExpeditionCoordinatorError(
            'no-signals',
            'This hollow has no community signals; resolving would invent a direction nobody chose'
          );
        }
        return await this.extendForNoSignals(state, input.operationId);
      }
      if (state.status === 'open') {
        state = await this.repository.update(input.subredditId, input.seasonId, (current) =>
          transitionExpedition(current, {
            to: 'resolving', expectedRevision: current.revision, cause: input.force ? 'moderator-resolve' : 'scheduler-resolve',
            operationId: `${input.operationId}:resolving`, at: this.now().toISOString(),
          }).state
        );
      }
      if (state.status !== 'resolving') {
        if (state.history.some((summary) => summary.day === input.day)) return state;
        throw new ExpeditionCoordinatorError('invalid-state', `Cannot resolve expedition from ${state.status}`);
      }
      const resolved = await this.rounds.resolve(state.subredditId, currentPostId, input.day);
      state = await this.applyResolution(state, resolved, input.operationId);
      const latest = state.history.find((summary) => summary.day === input.day);
      if (!latest) throw new ExpeditionCoordinatorError('invalid-state', 'Resolution did not append history');
      await this.posts.updateFallback(latest.postId, createResolvedFallback({
        day: latest.day, direction: latest.winningDirection, counts: latest.counts,
        severity: latest.severity, consequence: latest.consequenceCopy,
      }));
      if (state.status !== 'completed') {
        await this.schedulePublish(state, input.operationId);
      }
      return state;
    });
  }

  async publishNext(subredditId: string, seasonId: string, operationId: string): Promise<ExpeditionState> {
    const state = await this.requireState(subredditId, seasonId);
    if (state.status === 'completed') return state;
    if (state.status === 'open' && state.currentDay > 1) return state;
    if (state.status !== 'next-chapter-pending') throw new ExpeditionCoordinatorError('invalid-state', 'Next chapter is not pending');
    if (state.currentDay >= 7) throw new ExpeditionCoordinatorError('invalid-state', 'Day 7 cannot create Day 8');
    return await this.publishDay(subredditId, seasonId, state.currentDay + 1, operationId);
  }

  async reconcile(subredditId: string, operationId: string): Promise<ExpeditionState | null> {
    let state = await this.repository.getActive(subredditId);
    if (!state || state.status === 'completed') return state;
    if (state.status === 'scheduled') {
      return await this.publishDay(subredditId, state.seasonId, 1, `${operationId}:recover-day-1`);
    }
    if (state.status === 'open') {
      if (this.now().getTime() >= Date.parse(state.window.closesAt)) {
        return await this.resolve({ subredditId, seasonId: state.seasonId, day: state.currentDay, operationId: `${operationId}:resolve` });
      }
      await this.scheduleResolve(state, `${operationId}:ensure-resolve`);
      return state;
    }
    if (state.status === 'resolving') {
      if (!state.currentPostId) throw new ExpeditionCoordinatorError('invalid-state', 'Resolving chapter has no post');
      const round = await this.rounds.get(state.subredditId, state.currentPostId, state.currentDay);
      if (round.resolution) {
        state = await this.applyResolution(state, { status: 'resolved', alreadyResolved: true, resolution: round.resolution }, `${operationId}:recover-resolution`);
        if (state.status !== 'completed') await this.schedulePublish(state, operationId);
        return state;
      }
      return await this.resolve({ subredditId, seasonId: state.seasonId, day: state.currentDay, operationId: `${operationId}:retry-resolve`, force: true });
    }
    if (state.status === 'resolved') {
      state = await this.repository.update(subredditId, state.seasonId, (current) => transitionExpedition(current, {
        to: 'next-chapter-pending', expectedRevision: current.revision, cause: 'reconcile-resolved',
        operationId: `${operationId}:pending`, at: this.now().toISOString(),
      }).state);
    }
    if (state.status === 'next-chapter-pending') {
      if (this.now().getTime() < Date.parse(state.window.nextChapterAt)) {
        await this.schedulePublish(state, `${operationId}:ensure-publish`);
        return state;
      }
      return await this.publishNext(subredditId, state.seasonId, `${operationId}:publish`);
    }
    return state;
  }

  /**
   * Projects the journey as seen from one chapter post. `viewedDay` defaults to
   * the expedition's current day, but a reader inside an older post must see
   * that post's chapter — not wherever the expedition has since advanced to.
   * A past chapter is always reported `resolved`; only the live chapter carries
   * the open window and the expedition status.
   */
  toPublicView(state: ExpeditionState, viewedDay: number = state.currentDay): ExpeditionPublicView {
    const day = state.postsByDay[String(viewedDay)] ? viewedDay : state.currentDay;
    const isCurrentChapter = day === state.currentDay;
    const chapter = getChapter(day);
    return {
      schemaVersion: 2, seasonId: state.seasonId,
      status: isCurrentChapter ? state.status : 'resolved',
      currentDay: day, totalDays: 7,
      chapter: { day: chapter.day, name: chapter.name, phrase: chapter.phrase, cavernType: chapter.cavernType, cliffhanger: chapter.cliffhanger },
      window: state.window, murmur: { ...state.murmur, scars: [...state.murmur.scars] },
      history: state.history.map((summary) => ({
        day: summary.day, direction: summary.winningDirection, severity: summary.severity,
        consequence: summary.consequenceCopy, resolvedAt: summary.resolvedAt,
      })),
      ending: state.ending,
      schedulerDelayed: isCurrentChapter && state.status === 'open' &&
        this.now().getTime() > Date.parse(state.window.closesAt) + 60_000,
      nextChapterPostId: state.postsByDay[String(day + 1)] ?? null,
    };
  }

  /**
   * Keeps a zero-signal round open by pushing its window forward instead of
   * resolving it. Applies to every community: MURMUR never follows a direction
   * nobody chose. Repeated reconciliation is a no-op while the window is live.
   */
  private async extendForNoSignals(state: ExpeditionState, operationId: string): Promise<ExpeditionState> {
    const now = this.now();
    return await this.repository.update(state.subredditId, state.seasonId, (current) => {
      if (current.status !== 'open') return current;
      if (Date.parse(current.window.closesAt) > now.getTime()) return current;
      const extended = createRoundWindow(now, this.windowProfile);
      const at = now.toISOString();
      return {
        ...current,
        window: { ...extended, opensAt: current.window.opensAt },
        updatedAt: at,
        revision: current.revision + 1,
        transitions: [...current.transitions, {
          from: 'open', to: 'open', previousRevision: current.revision, nextRevision: current.revision + 1,
          at, cause: 'extend-no-signals', operationId: `${operationId}:extend-no-signals`,
          auditHash: computeBranchHash(current.seasonId, current.history),
        }],
      };
    });
  }

  private async publishDay(subredditId: string, seasonId: string, day: number, operationId: string): Promise<ExpeditionState> {
    const keys = createExpeditionKeys(subredditId, seasonId);
    return await this.withLease(keys.publishLease(day), async () => {
      let state = await this.requireState(subredditId, seasonId);
      const storedPost = state.postsByDay[String(day)];
      if (storedPost) return state;
      let postId = await this.posts.find(seasonId, day, state.subredditName);
      if (!postId) {
        await this.redis.set(keys.publishIntent(day), JSON.stringify({ seasonId, day, operationId, createdAt: this.now().toISOString() }));
        const scenario = state.scenarioByDay[String(day)] ?? createScenarioIdentityV2(
          seasonId, day, state.history, WORLD_GENERATOR_VERSION + 1
        );
        postId = await this.posts.create(createChapterPostSpec(state.subredditName, seasonId, day, scenario.generatorVersion));
      }
      const opensAt = this.now();
      state = await this.repository.update(subredditId, seasonId, (current) => {
        const already = current.postsByDay[String(day)];
        if (already) return current;
        const scenario = current.scenarioByDay[String(day)] ?? createScenarioIdentityV2(
          seasonId, day, current.history, WORLD_GENERATOR_VERSION + 1
        );
        const previousPostIds = current.currentPostId && current.currentPostId !== postId
          ? [...current.previousPostIds, current.currentPostId]
          : [...current.previousPostIds];
        const base: ExpeditionState = {
          ...current,
          currentDay: day,
          currentPostId: postId,
          previousPostIds,
          postsByDay: { ...current.postsByDay, [String(day)]: postId },
          scenarioByDay: { ...current.scenarioByDay, [String(day)]: scenario },
          window: createRoundWindow(opensAt, this.windowProfile),
        };
        return transitionExpedition(base, {
          to: 'open', expectedRevision: base.revision, cause: day === 1 ? 'open-expedition' : 'publish-next-chapter',
          operationId: `${operationId}:open`, at: opensAt.toISOString(),
        }).state;
      });
      await this.redis.set(keys.post(day), postId);
      await this.redis.set(keys.transition(day, 'publish-next'), JSON.stringify({ postId, operationId, at: this.now().toISOString() }));
      await this.scheduleResolve(state, operationId);
      if (day > 1) {
        const previous = state.history.find((summary) => summary.day === day - 1);
        if (previous) await this.posts.updateFallback(previous.postId, createResolvedFallback({
          day: previous.day, direction: previous.winningDirection, counts: previous.counts,
          severity: previous.severity, consequence: previous.consequenceCopy, nextPostId: postId,
        }));
      }
      return state;
    });
  }

  private async applyResolution(
    state: ExpeditionState,
    response: ResolveRoundResponse,
    operationId: string
  ): Promise<ExpeditionState> {
    const scenarioIdentity = state.scenarioByDay[String(state.currentDay)];
    if (!scenarioIdentity || !state.currentPostId) throw new ExpeditionCoordinatorError('invalid-state', 'Resolution lacks scenario or post identity');
    const resolvedPostId = state.currentPostId;
    const truth = generateScenarioV2(scenarioIdentity);
    const consequence = applyConsequence(state, truth, response.resolution.winningDirection);
    return await this.repository.update(state.subredditId, state.seasonId, (current) => {
      if (current.history.some((summary) => summary.day === state.currentDay)) return current;
      let next = transitionExpedition(current, {
        to: 'resolved', expectedRevision: current.revision, cause: 'round-snapshot-frozen',
        operationId: `${operationId}:resolved`, at: response.resolution.resolvedAt,
      }).state;
      const summary = {
        day: current.currentDay,
        postId: resolvedPostId,
        winningDirection: response.resolution.winningDirection,
        counts: response.resolution.countsSnapshot,
        severity: consequence.severity,
        consequenceTag: consequence.tag,
        consequenceCopy: consequence.copy,
        branchHash: scenarioIdentity.branchHash,
        scenarioIdentity,
        resolvedAt: response.resolution.resolvedAt,
        roundAuditHash: response.resolution.auditHash,
      };
      next = {
        ...next,
        murmur: {
          vitality: consequence.vitality, condition: consequence.condition,
          memoryFragments: consequence.memoryFragments, scars: consequence.scars,
        },
        history: [...next.history, summary],
      };
      next = transitionExpedition(next, {
        to: 'next-chapter-pending', expectedRevision: next.revision, cause: 'consequence-applied',
        operationId: `${operationId}:pending`, at: this.now().toISOString(),
      }).state;
      if (next.currentDay === 7) {
        const ending = endingForState(next);
        next = transitionExpedition({ ...next, ending }, {
          to: 'completed', expectedRevision: next.revision, cause: 'seven-days-complete',
          operationId: `${operationId}:complete`, at: this.now().toISOString(),
        }).state;
      }
      return next;
    });
  }

  private async scheduleResolve(state: ExpeditionState, operationId: string): Promise<void> {
    const keys = createExpeditionKeys(state.subredditId, state.seasonId);
    const scheduledKey = keys.scheduledJob(state.currentDay, 'resolve-round');
    if (await this.redis.get(scheduledKey)) return;
    const jobId = await this.jobs.schedule('resolve-round', {
      seasonId: state.seasonId, subredditId: state.subredditId, day: state.currentDay,
      operationId: `${operationId}:scheduled-resolve`,
    }, new Date(state.window.closesAt));
    await this.redis.set(keys.job(jobId), JSON.stringify({ name: 'resolve-round', day: state.currentDay }));
    await this.redis.set(scheduledKey, jobId);
  }

  private async schedulePublish(state: ExpeditionState, operationId: string): Promise<void> {
    const keys = createExpeditionKeys(state.subredditId, state.seasonId);
    const targetDay = state.currentDay + 1;
    const scheduledKey = keys.scheduledJob(targetDay, 'publish-next-chapter');
    if (await this.redis.get(scheduledKey)) return;
    const jobId = await this.jobs.schedule('publish-next-chapter', {
      seasonId: state.seasonId, subredditId: state.subredditId, day: targetDay,
      operationId: `${operationId}:scheduled-publish`,
    }, new Date(Math.max(this.now().getTime(), Date.parse(state.window.nextChapterAt))));
    await this.redis.set(keys.job(jobId), JSON.stringify({ name: 'publish-next-chapter', day: targetDay }));
    await this.redis.set(scheduledKey, jobId);
  }

  private async requireState(subredditId: string, seasonId: string): Promise<ExpeditionState> {
    const state = await this.repository.get(subredditId, seasonId);
    if (!state) throw new ExpeditionCoordinatorError('not-found', 'Expedition does not exist');
    return state;
  }

  private async withLease<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    for (let attempt = 0; attempt < 160; attempt += 1) {
      if (await this.redis.set(key, token, { nx: true, expiration: new Date(Date.now() + 60_000) }) === 'OK') {
        try { return await operation(); }
        finally { if (await this.redis.get(key) === token) await this.redis.del(key); }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(4 + attempt, 30)));
    }
    throw new ExpeditionCoordinatorError('busy', 'Expedition operation lease is busy');
  }
}
