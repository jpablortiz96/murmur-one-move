import { describe, expect, test } from 'vitest';
import { CHAPTERS } from '../src/server/game/expedition/chapters';
import { computeBranchHash, createScenarioIdentityV2 } from '../src/server/game/expedition/branching';
import { applyConsequence, endingForState } from '../src/server/game/expedition/consequenceEngine';
import { createExpedition } from '../src/server/game/expedition/createExpedition';
import type { ExpeditionDaySummary, ExpeditionState } from '../src/server/game/expedition/expeditionTypes';
import { ExpeditionTransitionError, transitionExpedition } from '../src/server/game/expedition/stateMachine';
import { generateScenarioV2 } from '../src/server/game/world/generateScenarioV2';
import { getChapter } from '../src/server/game/expedition/chapters';

const now = new Date('2026-07-13T18:00:00.000Z');
const createState = (): ExpeditionState => createExpedition({
  subredditId: 't5_test',
  subredditName: 'murmur_test',
  now,
  seasonId: 'season-test-0001',
});

const transition = (state: ExpeditionState, to: Parameters<typeof transitionExpedition>[1]['to'], id: string) =>
  transitionExpedition(state, {
    to,
    expectedRevision: state.revision,
    cause: 'test',
    operationId: id,
    at: new Date(now.getTime() + state.revision * 1_000).toISOString(),
  }).state;

describe('seven-day expedition model', () => {
  test('defines exactly seven non-generic biological chapters and no Day 8', () => {
    expect(CHAPTERS).toHaveLength(7);
    expect(CHAPTERS.map((chapter) => chapter.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(() => getChapter(8)).toThrow(RangeError);
    expect(new Set(CHAPTERS.map((chapter) => chapter.name)).size).toBe(7);
  });

  test('accepts every valid transition and records immutable audit history', () => {
    let state = createState();
    for (const [index, status] of ['open', 'resolving', 'resolved', 'next-chapter-pending', 'completed'].entries()) {
      const before = state;
      state = transition(state, status as ExpeditionState['status'], `op-${index}`);
      expect(before.transitions).toHaveLength(index);
      expect(state.transitions).toHaveLength(index + 1);
      expect(state.transitions[index]?.auditHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
    expect(state.status).toBe('completed');
    expect(state.completedAt).not.toBeNull();
  });

  test('rejects invalid transitions and stale revisions', () => {
    const state = createState();
    expect(() => transitionExpedition(state, {
      to: 'resolved', expectedRevision: 0, cause: 'skip', operationId: 'skip', at: now.toISOString(),
    })).toThrowError(ExpeditionTransitionError);
    expect(() => transitionExpedition(state, {
      to: 'open', expectedRevision: 1, cause: 'stale', operationId: 'stale', at: now.toISOString(),
    })).toThrowError(expect.objectContaining({ code: 'stale-revision' }));
  });

  test('makes an exact transition retry idempotent and rejects operation reuse', () => {
    const initial = createState();
    const command = { to: 'open' as const, expectedRevision: 0, cause: 'start', operationId: 'same-op', at: now.toISOString() };
    const first = transitionExpedition(initial, command);
    const repeated = transitionExpedition(first.state, command);
    expect(first.changed).toBe(true);
    expect(repeated.changed).toBe(false);
    expect(repeated.state.revision).toBe(1);
    expect(() => transitionExpedition(first.state, { ...command, to: 'resolving', expectedRevision: 1 })).toThrowError(
      expect.objectContaining({ code: 'operation-conflict' })
    );
  });
});

describe('branching consequences', () => {
  test('same history creates the same branch and changed history creates another', () => {
    const base = createState();
    const scenario = base.scenarioByDay['1'];
    expect(scenario).toBeDefined();
    const summary: ExpeditionDaySummary = {
      day: 1, postId: 't3_one', winningDirection: 'north',
      counts: { north: 1, east: 0, south: 0, west: 0, total: 1 },
      severity: 'safe', consequenceTag: 'echo-memory', consequenceCopy: 'safe',
      branchHash: 'sha256:before', scenarioIdentity: scenario!, resolvedAt: now.toISOString(), roundAuditHash: 'sha256:round',
    };
    expect(computeBranchHash(base.seasonId, [summary])).toBe(computeBranchHash(base.seasonId, [summary]));
    expect(computeBranchHash(base.seasonId, [summary])).not.toBe(
      computeBranchHash(base.seasonId, [{ ...summary, severity: 'dangerous' }])
    );
    expect(createScenarioIdentityV2(base.seasonId, 2, [summary], 2).day).toBe(2);
  });

  test('applies safe, costly, and dangerous outcomes without leaving vitality range', () => {
    const state = createState();
    const identity = state.scenarioByDay['1'];
    if (!identity) throw new Error('Missing test identity');
    const truth = generateScenarioV2(identity);
    const safe = applyConsequence(state, truth, truth.optimalDirection);
    const costlyDirection = truth.paths.find((path) => path.outcome.consequenceId === 'spore-sleep')?.direction;
    const dangerousDirection = truth.paths.find((path) => path.outcome.consequenceId === 'nest-awakens')?.direction;
    if (!costlyDirection || !dangerousDirection) throw new Error('Missing consequence paths');
    const costly = applyConsequence(state, truth, costlyDirection);
    const dangerous = applyConsequence(state, truth, dangerousDirection);
    expect(safe).toMatchObject({ severity: 'safe', vitality: 3, memoryFragments: 1 });
    expect(costly).toMatchObject({ severity: 'costly', vitality: 2 });
    expect(dangerous).toMatchObject({ severity: 'dangerous', vitality: 2 });
    expect([safe, costly, dangerous].every((result) => result.vitality >= 0 && result.vitality <= 3)).toBe(true);
  });

  test('keeps all three endings reachable', () => {
    const state = createState();
    expect(endingForState({ murmur: { ...state.murmur, vitality: 3, memoryFragments: 6 } })).toBe('the-chorus');
    expect(endingForState({ murmur: { ...state.murmur, vitality: 1, memoryFragments: 2 } })).toBe('the-survivor');
    expect(endingForState({ murmur: { ...state.murmur, vitality: 0, memoryFragments: 6 } })).toBe('the-fading-signal');
  });
});
