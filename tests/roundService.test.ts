import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { createRoundKeys } from '../src/server/services/roundKeys';
import {
  createRoundIdentity,
  RoundService,
  RoundServiceError,
} from '../src/server/services/roundService';
import type { Sensor } from '../src/shared/types/game';

const test = createDevvitTest();

const createService = (
  sensorForUser: (userId: string) => Sensor = () => 'echo'
): RoundService => {
  let tick = 0;
  return new RoundService({
    redis,
    identity: createRoundIdentity('t5_testsub', 't3_round'),
    now: () => new Date(Date.UTC(2026, 6, 13, 12, 0, tick++)),
    sensorForUser,
    maxTransactionAttempts: 20,
  });
};

test('creates one active vote and makes exact retries idempotent', async () => {
  const service = createService();
  const first = await service.submitVote('t2_alice', {
    direction: 'north',
    requestId: 'alice_req_01',
  });
  const repeated = await service.submitVote('t2_alice', {
    direction: 'north',
    requestId: 'alice_req_01',
  });
  expect(first.status).toBe('recorded');
  expect(repeated.status).toBe('idempotent');
  expect(repeated.activeVote.revision).toBe(1);
  expect(repeated.counts).toEqual({ north: 1, east: 0, south: 0, west: 0, total: 1 });
  const state = await service.getState('t2_alice', false);
  expect(state.viewer.activeVote?.direction).toBe('north');
});

test('rejects reusing an idempotency key for a different direction', async () => {
  const service = createService();
  await service.submitVote('t2_alice', {
    direction: 'north',
    requestId: 'alice_req_01',
  });
  await expect(
    service.submitVote('t2_alice', {
      direction: 'south',
      requestId: 'alice_req_01',
    })
  ).rejects.toMatchObject<Partial<RoundServiceError>>({ code: 'idempotency-conflict' });
});

test('changes a vote without changing total or producing negative counters', async () => {
  const service = createService();
  await service.submitVote('t2_alice', {
    direction: 'north',
    requestId: 'alice_req_01',
  });
  const changed = await service.submitVote('t2_alice', {
    direction: 'west',
    requestId: 'alice_req_02',
  });
  expect(changed.activeVote.revision).toBe(2);
  expect(changed.counts).toEqual({ north: 0, east: 0, south: 0, west: 1, total: 1 });
});

test('stores only the server resolver sensor across change and idempotent retry', async () => {
  const service = createService(() => 'wind');
  const first = await service.submitVote('t2_alice', {
    direction: 'north',
    requestId: 'trusted_sensor_01',
  });
  const changed = await service.submitVote('t2_alice', {
    direction: 'south',
    requestId: 'trusted_sensor_02',
  });
  const repeated = await service.submitVote('t2_alice', {
    direction: 'south',
    requestId: 'trusted_sensor_02',
  });
  expect(first.activeVote.sensor).toBe('wind');
  expect(changed.activeVote.sensor).toBe('wind');
  expect(repeated.activeVote.sensor).toBe('wind');
  expect(repeated.counts.total).toBe(1);
});

test('serializes concurrent first votes and preserves aggregate invariants', async () => {
  const service = createService();
  const directions = ['north', 'east', 'south', 'west'] as const;
  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      service.submitVote(`t2_user_${index}`, {
        direction: directions[index % directions.length],
        requestId: `parallel_req_${index}`,
      })
    )
  );
  const state = await service.getState(undefined, false);
  expect(state.counts).toEqual({ north: 3, east: 3, south: 3, west: 3, total: 12 });
});

test('keeps one active vote when the same user changes concurrently', async () => {
  const service = createService();
  await Promise.all([
    service.submitVote('t2_alice', { direction: 'north', requestId: 'alice_parallel_1' }),
    service.submitVote('t2_alice', { direction: 'south', requestId: 'alice_parallel_2' }),
    service.submitVote('t2_alice', { direction: 'west', requestId: 'alice_parallel_3' }),
  ]);
  const state = await service.getState('t2_alice', false);
  expect(state.counts.total).toBe(1);
  expect(state.counts.north + state.counts.east + state.counts.south + state.counts.west).toBe(1);
  expect(state.viewer.activeVote?.revision).toBe(3);
});

test('serializes a vote racing manual resolution into a valid frozen state', async () => {
  const service = createService();
  const outcomes = await Promise.allSettled([
    service.submitVote('t2_alice', { direction: 'east', requestId: 'alice_race_01' }),
    service.resolve(),
  ]);
  const state = await service.getState('t2_alice', false);
  expect(state.status).toBe('resolved');
  expect(state.resolution).not.toBeNull();
  expect(state.counts).toEqual(state.resolution?.countsSnapshot);
  const voteOutcome = outcomes[0];
  if (state.counts.total === 0) {
    expect(voteOutcome.status).toBe('rejected');
  } else {
    expect(voteOutcome.status).toBe('fulfilled');
  }
});

test('freezes an immutable resolution and refuses later votes', async () => {
  const service = createService((userId) =>
    userId.endsWith('wind') ? 'wind' : userId.endsWith('heat') ? 'heat' : 'echo'
  );
  await service.submitVote('t2_a_echo', { direction: 'east', requestId: 'request_a1' });
  await service.submitVote('t2_b_heat', { direction: 'east', requestId: 'request_b1' });
  await service.submitVote('t2_c_echo', { direction: 'north', requestId: 'request_c1' });
  await service.submitVote('t2_d_echo', { direction: 'north', requestId: 'request_d1' });
  const first = await service.resolve();
  const repeated = await service.resolve();
  expect(first.alreadyResolved).toBe(false);
  expect(repeated.alreadyResolved).toBe(true);
  expect(repeated.resolution).toEqual(first.resolution);
  expect(first.resolution.winningDirection).toBe('east');
  expect(first.resolution.tieBreak).toBe('sensor-diversity');
  expect(first.resolution.auditHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  await expect(
    service.submitVote('t2_late', { direction: 'south', requestId: 'late_req_1' })
  ).rejects.toMatchObject<Partial<RoundServiceError>>({ code: 'round-resolved' });
});

test('detects a corrupt active vote before mutation or resolution', async () => {
  const service = createService();
  await service.submitVote('t2_alice', {
    direction: 'north',
    requestId: 'alice_req_01',
  });
  const keys = createRoundKeys(createRoundIdentity('t5_testsub', 't3_round'));
  const voterFields = await redis.hKeys(keys.votes);
  const voterField = voterFields[0];
  expect(voterField).toBeDefined();
  if (voterField === undefined) throw new Error('Expected one stored voter field');
  await redis.hSet(keys.votes, { [voterField]: '{"direction":"broken"}' });
  await expect(
    service.submitVote('t2_bob', { direction: 'east', requestId: 'bob_req_01' })
  ).rejects.toMatchObject<Partial<RoundServiceError>>({ code: 'storage-failure' });
  await expect(service.resolve()).rejects.toMatchObject<Partial<RoundServiceError>>({
    code: 'storage-failure',
  });
});
