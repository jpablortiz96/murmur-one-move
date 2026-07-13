import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { createExpedition } from '../src/server/game/expedition/createExpedition';
import { ExpeditionRepository, ExpeditionRepositoryError } from '../src/server/services/expeditionRepository';

const test = createDevvitTest();
const createState = (seasonId: string) => createExpedition({
  subredditId: 't5_repository', subredditName: 'murmur_repository',
  seasonId, now: new Date('2026-07-13T18:00:00.000Z'),
});

test('persists one active expedition and makes creation idempotent', async () => {
  const repository = new ExpeditionRepository(redis);
  const state = createState('season-repository-01');
  const first = await repository.create(state);
  const repeated = await repository.create(state);
  expect(first.created).toBe(true);
  expect(repeated.created).toBe(false);
  expect((await repository.getActive(state.subredditId))?.seasonId).toBe(state.seasonId);
});

test('rejects a simultaneous second active expedition', async () => {
  const repository = new ExpeditionRepository(redis);
  await repository.create(createState('season-repository-01'));
  await expect(repository.create(createState('season-repository-02'))).rejects.toMatchObject<Partial<ExpeditionRepositoryError>>({ code: 'already-active' });
});

test('serializes 100 state updates without losing revisions', async () => {
  const repository = new ExpeditionRepository(redis, 160);
  const state = createState('season-repository-01');
  await repository.create(state);
  await Promise.all(Array.from({ length: 100 }, () => repository.update(state.subredditId, state.seasonId, (current) => ({
    ...current, revision: current.revision + 1,
  }))));
  expect((await repository.get(state.subredditId, state.seasonId))?.revision).toBe(100);
});
