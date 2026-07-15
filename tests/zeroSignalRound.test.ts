import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import type { JsonObject } from '@devvit/shared';
import type { ResolveRoundResponse, RoundStateResponse } from '../src/shared/contracts/round';
import type {
  ChapterPostGateway,
  ExpeditionRoundGateway,
  ExpeditionScheduler,
} from '../src/server/services/expeditionCoordinator';
import { ExpeditionCoordinator, ExpeditionCoordinatorError } from '../src/server/services/expeditionCoordinator';
import { ExpeditionRepository } from '../src/server/services/expeditionRepository';
import type { ChapterPostSpec } from '../src/server/game/expedition/chapterPosts';
import { TEST_WINDOW } from '../src/server/game/expedition/windows';

const test = createDevvitTest();

class FakePosts implements ChapterPostGateway {
  readonly specs: ChapterPostSpec[] = [];
  async find(): Promise<string | null> {
    return null;
  }
  async create(spec: ChapterPostSpec): Promise<string> {
    this.specs.push(spec);
    return `t3_day_${spec.postData.murmur.day}`;
  }
  async updateFallback(): Promise<void> {}
}

class FakeJobs implements ExpeditionScheduler {
  async schedule(_n: 'resolve-round' | 'publish-next-chapter', _d: JsonObject, _r: Date): Promise<string> {
    return 'job-1';
  }
}

class FakeRounds implements ExpeditionRoundGateway {
  votes = 0;
  resolveCalls = 0;
  async get(_subredditId: string, _postId: string, day: number): Promise<RoundStateResponse> {
    const counts = { north: this.votes, east: 0, south: 0, west: 0, total: this.votes };
    return {
      schemaVersion: 1, chapter: day, day, status: 'open', counts, resolution: null,
      viewer: { authenticated: false, canVote: false, canResolve: false, sensor: 'echo', activeVote: null },
    };
  }
  async resolve(_subredditId: string, _postId: string, day: number): Promise<ResolveRoundResponse> {
    this.resolveCalls += 1;
    return {
      status: 'resolved', alreadyResolved: false,
      resolution: {
        status: 'resolved', winningDirection: 'north',
        countsSnapshot: { north: this.votes, east: 0, south: 0, west: 0, total: this.votes },
        sensorDiversityByDirection: { north: 1, east: 0, south: 0, west: 0 },
        tieBreak: 'vote-count', tiedDirections: ['north'],
        resolvedAt: new Date(Date.UTC(2026, 6, 15, 12, day)).toISOString(),
        resolutionVersion: 1, auditHash: `sha256:${String(day).padStart(64, '0')}`,
      },
    };
  }
}

const setup = (startAt = Date.UTC(2026, 6, 15, 12, 0)) => {
  let now = startAt;
  const rounds = new FakeRounds();
  const coordinator = new ExpeditionCoordinator(
    redis, new ExpeditionRepository(redis, 240), new FakePosts(), new FakeJobs(), rounds, TEST_WINDOW,
    () => new Date(now)
  );
  return { coordinator, rounds, advance: (ms: number) => { now += ms; }, at: () => now };
};

const start = async (coordinator: ExpeditionCoordinator) =>
  coordinator.start({
    subredditId: 't5_zero', subredditName: 'murmur_one_move_dev', seasonId: 'season-zero-01',
    now: new Date(Date.UTC(2026, 6, 15, 12, 0)), operationId: 'start-zero',
  });

test('a scheduled resolution of a zero-signal round keeps the hollow open instead of inventing a winner', async () => {
  const { coordinator, rounds, advance } = setup();
  const opened = await start(coordinator);
  const originalClosesAt = opened.window.closesAt;
  advance(TEST_WINDOW.openDurationMs + 1_000); // window expired, still nobody voted
  const state = await coordinator.resolve({
    subredditId: 't5_zero', seasonId: 'season-zero-01', day: 1, operationId: 'scheduled-resolve',
  });
  expect(state.status).toBe('open');
  expect(state.history).toHaveLength(0);
  expect(rounds.resolveCalls).toBe(0);
  expect(Date.parse(state.window.closesAt)).toBeGreaterThan(Date.parse(originalClosesAt));
});

test('a manual resolution of a zero-signal round is refused outright', async () => {
  const { coordinator, rounds } = setup();
  await start(coordinator);
  await expect(
    coordinator.resolve({
      subredditId: 't5_zero', seasonId: 'season-zero-01', day: 1,
      operationId: 'manual-resolve', force: true,
    })
  ).rejects.toMatchObject<Partial<ExpeditionCoordinatorError>>({ code: 'no-signals' });
  expect(rounds.resolveCalls).toBe(0);
});

test('reconcile on an expired zero-signal round extends it rather than resolving', async () => {
  const { coordinator, rounds, advance } = setup();
  await start(coordinator);
  advance(TEST_WINDOW.openDurationMs + 1_000);
  const state = await coordinator.reconcile('t5_zero', 'reconcile-zero');
  expect(state?.status).toBe('open');
  expect(state?.history).toHaveLength(0);
  expect(rounds.resolveCalls).toBe(0);
});

test('once a single signal exists the round resolves normally', async () => {
  const { coordinator, rounds, advance } = setup();
  await start(coordinator);
  rounds.votes = 1;
  advance(TEST_WINDOW.openDurationMs + 1_000);
  const state = await coordinator.resolve({
    subredditId: 't5_zero', seasonId: 'season-zero-01', day: 1, operationId: 'resolve-with-signal',
  });
  expect(rounds.resolveCalls).toBe(1);
  expect(state.history).toHaveLength(1);
  expect(state.history[0]?.counts.total).toBe(1);
});
