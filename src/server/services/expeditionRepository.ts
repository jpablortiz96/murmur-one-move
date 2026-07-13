import { randomUUID } from 'node:crypto';
import type { RedisClient, TxClientLike } from '@devvit/web/server';
import {
  isConsequenceSeverity,
  isConsequenceTag,
  isExpeditionStatus,
  isMurmurCondition,
  parseRoundWindow,
} from '../../shared/contracts/expedition';
import { parseCommunityCounts } from '../../shared/contracts/round';
import { createExpeditionKeys } from './expeditionKeys';
import type {
  ExpeditionDaySummary,
  ExpeditionState,
  ExpeditionTransition,
  ScenarioIdentityV2,
} from '../game/expedition/expeditionTypes';

type ExpeditionRedis = Pick<RedisClient, 'get' | 'set' | 'del' | 'watch'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const isHash = (value: unknown): value is string =>
  typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);

const isDirection = (value: unknown): value is 'north' | 'east' | 'south' | 'west' =>
  value === 'north' || value === 'east' || value === 'south' || value === 'west';

const parseScenarioIdentity = (value: unknown): ScenarioIdentityV2 | null => {
  if (!isRecord(value) || typeof value.seasonId !== 'string' ||
    typeof value.day !== 'number' || !Number.isInteger(value.day) || value.day < 1 || value.day > 7 ||
    !isHash(value.branchHash) || typeof value.generatorVersion !== 'number' || !Number.isInteger(value.generatorVersion)) return null;
  return { seasonId: value.seasonId, day: value.day, branchHash: value.branchHash, generatorVersion: value.generatorVersion };
};

const parseTransition = (value: unknown): ExpeditionTransition | null => {
  if (!isRecord(value) || !isExpeditionStatus(value.from) || !isExpeditionStatus(value.to) ||
    typeof value.previousRevision !== 'number' || !Number.isInteger(value.previousRevision) ||
    typeof value.nextRevision !== 'number' || value.nextRevision !== value.previousRevision + 1 ||
    !isTimestamp(value.at) || typeof value.cause !== 'string' || typeof value.operationId !== 'string' || !isHash(value.auditHash)) return null;
  return {
    from: value.from, to: value.to, previousRevision: value.previousRevision,
    nextRevision: value.nextRevision, at: value.at, cause: value.cause,
    operationId: value.operationId, auditHash: value.auditHash,
  };
};

const parseDaySummary = (value: unknown): ExpeditionDaySummary | null => {
  if (!isRecord(value) || typeof value.day !== 'number' || !Number.isInteger(value.day) || value.day < 1 || value.day > 7 ||
    typeof value.postId !== 'string' || !isDirection(value.winningDirection) ||
    !isConsequenceSeverity(value.severity) || !isConsequenceTag(value.consequenceTag) ||
    typeof value.consequenceCopy !== 'string' || !isHash(value.branchHash) || !isTimestamp(value.resolvedAt) || !isHash(value.roundAuditHash)) return null;
  const counts = parseCommunityCounts(value.counts);
  const scenarioIdentity = parseScenarioIdentity(value.scenarioIdentity);
  if (!counts || !scenarioIdentity) return null;
  return {
    day: value.day, postId: value.postId, winningDirection: value.winningDirection,
    counts, severity: value.severity, consequenceTag: value.consequenceTag,
    consequenceCopy: value.consequenceCopy, branchHash: value.branchHash,
    scenarioIdentity, resolvedAt: value.resolvedAt, roundAuditHash: value.roundAuditHash,
  };
};

const parseStringRecord = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value) || !Object.values(value).every((item) => typeof item === 'string')) return null;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item as string]));
};

const parseScenarioRecord = (value: unknown): Record<string, ScenarioIdentityV2> | null => {
  if (!isRecord(value)) return null;
  const parsed = Object.entries(value).map(([key, item]) => [key, parseScenarioIdentity(item)] as const);
  if (parsed.some(([, item]) => item === null)) return null;
  return Object.fromEntries(parsed) as Record<string, ScenarioIdentityV2>;
};

export const parseExpeditionState = (value: unknown): ExpeditionState | null => {
  if (!isRecord(value) || value.schemaVersion !== 2 || typeof value.seasonId !== 'string' ||
    typeof value.subredditId !== 'string' || typeof value.subredditName !== 'string' || !isExpeditionStatus(value.status) ||
    typeof value.currentDay !== 'number' || !Number.isInteger(value.currentDay) || value.currentDay < 1 || value.currentDay > 7 ||
    value.totalDays !== 7 || (value.currentPostId !== null && typeof value.currentPostId !== 'string') ||
    !Array.isArray(value.previousPostIds) || !value.previousPostIds.every((item) => typeof item === 'string') ||
    !isRecord(value.murmur) || typeof value.murmur.vitality !== 'number' || !Number.isInteger(value.murmur.vitality) ||
    value.murmur.vitality < 0 || value.murmur.vitality > 3 || !isMurmurCondition(value.murmur.condition) ||
    typeof value.murmur.memoryFragments !== 'number' || !Number.isInteger(value.murmur.memoryFragments) ||
    value.murmur.memoryFragments < 0 || value.murmur.memoryFragments > 7 || !Array.isArray(value.murmur.scars) ||
    !value.murmur.scars.every(isConsequenceTag) || !Array.isArray(value.history) || !Array.isArray(value.transitions) ||
    (value.ending !== null && value.ending !== 'the-chorus' && value.ending !== 'the-survivor' && value.ending !== 'the-fading-signal') ||
    !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt) ||
    (value.completedAt !== null && !isTimestamp(value.completedAt)) || typeof value.revision !== 'number' || !Number.isInteger(value.revision)) return null;
  const postsByDay = parseStringRecord(value.postsByDay);
  const scenarioByDay = parseScenarioRecord(value.scenarioByDay);
  const window = parseRoundWindow(value.window);
  const history = value.history.map(parseDaySummary);
  const transitions = value.transitions.map(parseTransition);
  if (!postsByDay || !scenarioByDay || !window || history.some((item) => item === null) || transitions.some((item) => item === null)) return null;
  return {
    schemaVersion: 2, seasonId: value.seasonId, subredditId: value.subredditId, subredditName: value.subredditName,
    status: value.status, currentDay: value.currentDay, totalDays: 7, currentPostId: value.currentPostId,
    previousPostIds: [...value.previousPostIds], postsByDay, scenarioByDay, window,
    murmur: { vitality: value.murmur.vitality, condition: value.murmur.condition, memoryFragments: value.murmur.memoryFragments, scars: [...value.murmur.scars] },
    history: history as ExpeditionDaySummary[], transitions: transitions as ExpeditionTransition[], ending: value.ending,
    createdAt: value.createdAt, updatedAt: value.updatedAt, completedAt: value.completedAt, revision: value.revision,
  };
};

export class ExpeditionRepositoryError extends Error {
  readonly code: 'not-found' | 'already-active' | 'storage-corrupt' | 'conflict';
  constructor(code: ExpeditionRepositoryError['code'], message: string) {
    super(message);
    this.name = 'ExpeditionRepositoryError';
    this.code = code;
  }
}

const parseRaw = (raw: string): ExpeditionState => {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ExpeditionRepositoryError('storage-corrupt', 'Expedition state is not valid JSON'); }
  const state = parseExpeditionState(value);
  if (!state) throw new ExpeditionRepositoryError('storage-corrupt', 'Expedition state failed validation');
  return state;
};

const execute = async (transaction: TxClientLike, commands: number): Promise<boolean> => {
  const result = await transaction.exec();
  return Array.isArray(result) && result.length === commands;
};

export class ExpeditionRepository {
  constructor(private readonly redis: ExpeditionRedis, private readonly maxAttempts = 12) {}

  async getActive(subredditId: string): Promise<ExpeditionState | null> {
    const placeholder = createExpeditionKeys(subredditId, 'active');
    const seasonId = await this.redis.get(placeholder.activeSeason);
    return seasonId ? await this.get(subredditId, seasonId) : null;
  }

  async get(subredditId: string, seasonId: string): Promise<ExpeditionState | null> {
    const raw = await this.redis.get(createExpeditionKeys(subredditId, seasonId).state);
    return raw ? parseRaw(raw) : null;
  }

  async create(state: ExpeditionState): Promise<{ state: ExpeditionState; created: boolean }> {
    const keys = createExpeditionKeys(state.subredditId, state.seasonId);
    return await this.withLease(keys.activeLease, async () => {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const transaction = await this.redis.watch(keys.activeSeason, keys.state);
      const [activeSeason, existingRaw] = await Promise.all([this.redis.get(keys.activeSeason), this.redis.get(keys.state)]);
      if (existingRaw) {
        await transaction.unwatch();
        return { state: parseRaw(existingRaw), created: false };
      }
      if (activeSeason) {
        const active = await this.get(state.subredditId, activeSeason);
        if (active && active.status !== 'completed') {
          await transaction.unwatch();
          throw new ExpeditionRepositoryError('already-active', 'This installation already has an active expedition');
        }
      }
      await transaction.multi();
      await transaction.set(keys.state, JSON.stringify(state));
      await transaction.set(keys.activeSeason, state.seasonId);
      if (await execute(transaction, 2)) return { state, created: true };
    }
    throw new ExpeditionRepositoryError('conflict', 'Could not create expedition after concurrent updates');
    });
  }

  async update(
    subredditId: string,
    seasonId: string,
    mutate: (state: ExpeditionState) => ExpeditionState
  ): Promise<ExpeditionState> {
    const keys = createExpeditionKeys(subredditId, seasonId);
    return await this.withLease(keys.stateLease, async () => {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const transaction = await this.redis.watch(keys.state);
      const raw = await this.redis.get(keys.state);
      if (!raw) {
        await transaction.unwatch();
        throw new ExpeditionRepositoryError('not-found', 'Expedition state does not exist');
      }
      const previous = parseRaw(raw);
      const next = mutate(previous);
      if (next.seasonId !== previous.seasonId || next.subredditId !== previous.subredditId) {
        await transaction.unwatch();
        throw new ExpeditionRepositoryError('storage-corrupt', 'Mutation changed expedition identity');
      }
      await transaction.multi();
      await transaction.set(keys.state, JSON.stringify(next));
      if (await execute(transaction, 1)) return next;
    }
    throw new ExpeditionRepositoryError('conflict', 'Expedition changed during update');
    });
  }

  private async withLease<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    let acquired = false;
    for (let attempt = 0; attempt < Math.max(200, this.maxAttempts * 4); attempt += 1) {
      const result = await this.redis.set(key, token, {
        nx: true,
        expiration: new Date(Date.now() + 15_000),
      });
      if (result === 'OK') {
        acquired = true;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(2 + attempt, 20)));
    }
    if (!acquired) throw new ExpeditionRepositoryError('conflict', 'Expedition state lease is busy');
    try {
      return await operation();
    } finally {
      if (await this.redis.get(key) === token) await this.redis.del(key);
    }
  }
}
