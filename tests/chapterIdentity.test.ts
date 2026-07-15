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
import { ExpeditionCoordinator } from '../src/server/services/expeditionCoordinator';
import { ExpeditionRepository } from '../src/server/services/expeditionRepository';
import type { ChapterPostSpec } from '../src/server/game/expedition/chapterPosts';
import { TEST_WINDOW } from '../src/server/game/expedition/windows';

const test = createDevvitTest();

class FakePosts implements ChapterPostGateway {
  async find(): Promise<string | null> {
    return null;
  }
  async create(spec: ChapterPostSpec): Promise<string> {
    return `t3_day_${spec.postData.murmur.day}`;
  }
  async updateFallback(): Promise<void> {}
}

class FakeJobs implements ExpeditionScheduler {
  async schedule(): Promise<string> {
    return 'job-1';
  }
}

class FakeRounds implements ExpeditionRoundGateway {
  async get(_s: string, _p: string, day: number): Promise<RoundStateResponse> {
    return {
      schemaVersion: 1, chapter: day, day, status: 'open',
      counts: { north: 1, east: 0, south: 0, west: 0, total: 1 }, resolution: null,
      viewer: { authenticated: false, canVote: false, canResolve: false, sensor: 'echo', activeVote: null },
    };
  }
  async resolve(_s: string, _p: string, day: number): Promise<ResolveRoundResponse> {
    return {
      status: 'resolved', alreadyResolved: false,
      resolution: {
        status: 'resolved', winningDirection: 'north',
        countsSnapshot: { north: 1, east: 0, south: 0, west: 0, total: 1 },
        sensorDiversityByDirection: { north: 1, east: 0, south: 0, west: 0 },
        tieBreak: 'vote-count', tiedDirections: ['north'],
        resolvedAt: new Date(Date.UTC(2026, 6, 15, 12, day)).toISOString(),
        resolutionVersion: 1, auditHash: `sha256:${String(day).padStart(64, '0')}`,
      },
    };
  }
}

const buildAtDayTwo = async () => {
  let tick = 0;
  const coordinator = new ExpeditionCoordinator(
    redis, new ExpeditionRepository(redis, 240), new FakePosts(), new FakeJobs(), new FakeRounds(), TEST_WINDOW,
    () => new Date(Date.UTC(2026, 6, 15, 12, 0, tick++))
  );
  let state = await coordinator.start({
    subredditId: 't5_identity', subredditName: 'murmur_one_move_dev', seasonId: 'season-identity',
    now: new Date(Date.UTC(2026, 6, 15, 12, 0)), operationId: 'start-identity',
  });
  state = await coordinator.closeRound(state.subredditId, state.seasonId, 'close-1');
  state = await coordinator.resolve({
    subredditId: state.subredditId, seasonId: state.seasonId, day: 1, operationId: 'resolve-1', force: true,
  });
  state = await coordinator.publishNext(state.subredditId, state.seasonId, 'publish-2');
  return { coordinator, state };
};

test('the Day 1 post renders Day 1 even after the expedition advanced to Day 2', async () => {
  const { coordinator, state } = await buildAtDayTwo();
  expect(state.currentDay).toBe(2);
  const view = coordinator.toPublicView(state, 1);
  expect(view.currentDay).toBe(1);
  expect(view.chapter.day).toBe(1);
  expect(view.chapter.name).toBe('The First Hollow');
  // A past chapter is settled, never presented as the live open round.
  expect(view.status).toBe('resolved');
  // It may still indicate that the next chapter is available.
  expect(view.nextChapterPostId).toBe('t3_day_2');
});

test('the Day 2 post renders Day 2 with the live expedition status', async () => {
  const { coordinator, state } = await buildAtDayTwo();
  const view = coordinator.toPublicView(state, 2);
  expect(view.currentDay).toBe(2);
  expect(view.chapter.day).toBe(2);
  expect(view.chapter.name).toBe('The Breathing Wall');
  expect(view.status).toBe(state.status);
  expect(view.nextChapterPostId).toBeNull();
});

test('an omitted viewed day still projects the expedition current day', async () => {
  const { coordinator, state } = await buildAtDayTwo();
  expect(coordinator.toPublicView(state).currentDay).toBe(state.currentDay);
});

test('a day with no post falls back to the current chapter rather than inventing one', async () => {
  const { coordinator, state } = await buildAtDayTwo();
  const view = coordinator.toPublicView(state, 7); // never published
  expect(view.currentDay).toBe(state.currentDay);
  expect(view.chapter.day).toBe(state.currentDay);
});

test('the resolved Day 1 view keeps the shared history and murmur condition', async () => {
  const { coordinator, state } = await buildAtDayTwo();
  const view = coordinator.toPublicView(state, 1);
  expect(view.history).toHaveLength(1);
  expect(view.history[0]?.day).toBe(1);
  expect(view.murmur.vitality).toBe(state.murmur.vitality);
});
