import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import type { JsonObject } from '@devvit/shared';
import { hasOnlySmallPostReference } from '../src/shared/contracts/expedition';
import type { ResolveRoundResponse, RoundResolution, RoundStateResponse } from '../src/shared/contracts/round';
import type { ChapterPostGateway, ExpeditionRoundGateway, ExpeditionScheduler } from '../src/server/services/expeditionCoordinator';
import { ExpeditionCoordinator } from '../src/server/services/expeditionCoordinator';
import { ExpeditionRepository } from '../src/server/services/expeditionRepository';
import type { ChapterPostSpec } from '../src/server/game/expedition/chapterPosts';
import { TEST_WINDOW } from '../src/server/game/expedition/windows';

const test = createDevvitTest();

class FakePosts implements ChapterPostGateway {
  readonly specs: ChapterPostSpec[] = [];
  readonly fallbacks = new Map<string, string>();
  private readonly ids = new Map<string, string>();
  failAfterCreateOnce = false;

  async find(seasonId: string, day: number): Promise<string | null> {
    return this.ids.get(`${seasonId}:${day}`) ?? null;
  }

  async create(spec: ChapterPostSpec): Promise<string> {
    this.specs.push(spec);
    const day = spec.postData.murmur.day;
    const key = `${spec.postData.murmur.seasonId}:${day}`;
    const id = `t3_day_${day}`;
    this.ids.set(key, id);
    if (this.failAfterCreateOnce) {
      this.failAfterCreateOnce = false;
      throw new Error('simulated response loss after post creation');
    }
    return id;
  }

  async updateFallback(postId: string, text: string): Promise<void> {
    this.fallbacks.set(postId, text);
  }
}

class FakeJobs implements ExpeditionScheduler {
  readonly jobs: Array<{ name: string; data: JsonObject; runAt: Date }> = [];
  async schedule(name: 'resolve-round' | 'publish-next-chapter', data: JsonObject, runAt: Date): Promise<string> {
    this.jobs.push({ name, data, runAt });
    return `job-${this.jobs.length}`;
  }
}

const resolution = (day: number): RoundResolution => ({
  status: 'resolved', winningDirection: day % 2 === 0 ? 'east' : 'north',
  countsSnapshot: day % 2 === 0
    ? { north: 0, east: 1, south: 0, west: 0, total: 1 }
    : { north: 1, east: 0, south: 0, west: 0, total: 1 },
  sensorDiversityByDirection: { north: 1, east: 1, south: 0, west: 0 },
  tieBreak: 'vote-count', tiedDirections: [day % 2 === 0 ? 'east' : 'north'],
  resolvedAt: new Date(Date.UTC(2026, 6, 13, 18, day)).toISOString(),
  resolutionVersion: 1, auditHash: `sha256:${String(day).padStart(64, '0')}`,
});

class FakeRounds implements ExpeditionRoundGateway {
  readonly calls = new Map<number, number>();
  async get(_subredditId: string, _postId: string, day: number): Promise<RoundStateResponse> {
    const value = this.calls.has(day) ? resolution(day) : null;
    return {
      schemaVersion: 1, chapter: day, day, status: value ? 'resolved' : 'open',
      counts: value?.countsSnapshot ?? { north: 0, east: 0, south: 0, west: 0, total: 0 },
      resolution: value,
      viewer: { authenticated: false, canVote: false, canResolve: false, sensor: 'echo', activeVote: null },
    };
  }
  async resolve(_subredditId: string, _postId: string, day: number): Promise<ResolveRoundResponse> {
    this.calls.set(day, (this.calls.get(day) ?? 0) + 1);
    return { status: 'resolved', alreadyResolved: (this.calls.get(day) ?? 0) > 1, resolution: resolution(day) };
  }
}

const setup = () => {
  let tick = 0;
  const posts = new FakePosts();
  const jobs = new FakeJobs();
  const rounds = new FakeRounds();
  const coordinator = new ExpeditionCoordinator(
    redis, new ExpeditionRepository(redis, 240), posts, jobs, rounds, TEST_WINDOW,
    () => new Date(Date.UTC(2026, 6, 13, 18, 0, tick++))
  );
  return { coordinator, posts, jobs, rounds };
};

test('persists Day 1 with a neutral title, small postData, fallback, and close job', async () => {
  const { coordinator, posts, jobs } = setup();
  const state = await coordinator.start({
    subredditId: 't5_coordinator', subredditName: 'murmur_test', seasonId: 'season-coordinator-01',
    now: new Date('2026-07-13T18:00:00.000Z'), operationId: 'start-01',
  });
  expect(state).toMatchObject({ status: 'open', currentDay: 1, currentPostId: 't3_day_1' });
  expect(posts.specs).toHaveLength(1);
  expect(posts.specs[0]?.title).toBe('MURMUR — Day 1: The First Hollow');
  expect(posts.specs[0]?.title).not.toMatch(/Echo|Heat|Wind/);
  expect(posts.specs[0]?.textFallback.text).not.toMatch(/safeDirection|survivable|solution/i);
  expect(hasOnlySmallPostReference(posts.specs[0]?.postData)).toBe(true);
  expect(jobs.jobs.filter((job) => job.name === 'resolve-round')).toHaveLength(1);
});

test('recovers a lost create response without producing a duplicate post', async () => {
  const { coordinator, posts } = setup();
  posts.failAfterCreateOnce = true;
  await expect(coordinator.start({
    subredditId: 't5_coordinator', subredditName: 'murmur_test', seasonId: 'season-coordinator-01',
    now: new Date('2026-07-13T18:00:00.000Z'), operationId: 'start-lost',
  })).rejects.toThrow('simulated response loss');
  const recovered = await coordinator.reconcile('t5_coordinator', 'reconcile-lost');
  expect(recovered).toMatchObject({ status: 'open', currentPostId: 't3_day_1' });
  expect(posts.specs).toHaveLength(1);
});

test('100 resolve and publish calls create one immutable history entry and one Day 2 post', async () => {
  const { coordinator, posts, rounds } = setup();
  let state = await coordinator.start({
    subredditId: 't5_coordinator', subredditName: 'murmur_test', seasonId: 'season-coordinator-01',
    now: new Date('2026-07-13T18:00:00.000Z'), operationId: 'start-race',
  });
  state = await coordinator.closeRound(state.subredditId, state.seasonId, 'close-race');
  const resolutions = await Promise.all(Array.from({ length: 100 }, (_, index) => coordinator.resolve({
    subredditId: state.subredditId, seasonId: state.seasonId, day: 1,
    operationId: `resolve-race-${index}`, force: true,
  })));
  expect(resolutions.at(-1)?.history).toHaveLength(1);
  expect(rounds.calls.get(1)).toBe(1);
  const publications = await Promise.all(Array.from({ length: 100 }, (_, index) =>
    coordinator.publishNext(state.subredditId, state.seasonId, `publish-race-${index}`)
  ));
  expect(publications.at(-1)).toMatchObject({ status: 'open', currentDay: 2, currentPostId: 't3_day_2' });
  expect(posts.specs.filter((spec) => spec.postData.murmur.day === 2)).toHaveLength(1);
  expect(posts.fallbacks.get('t3_day_1')).toContain('https://reddit.com/comments/day_2');
}, 30_000);

test('reconcile on an open current day never creates an extra chapter', async () => {
  const { coordinator, posts } = setup();
  const state = await coordinator.start({
    subredditId: 't5_coordinator', subredditName: 'murmur_test', seasonId: 'season-coordinator-01',
    now: new Date('2026-07-13T18:00:00.000Z'), operationId: 'start-reconcile',
  });
  await coordinator.reconcile(state.subredditId, 'reconcile-open');
  expect(posts.specs).toHaveLength(1);
});
