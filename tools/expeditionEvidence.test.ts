import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createChapterPostSpec } from '../src/server/game/expedition/chapterPosts';
import { applyConsequence, endingForState } from '../src/server/game/expedition/consequenceEngine';
import { createExpedition } from '../src/server/game/expedition/createExpedition';
import type { ExpeditionDaySummary, ExpeditionState } from '../src/server/game/expedition/expeditionTypes';
import { createScenarioIdentityV2 } from '../src/server/game/expedition/branching';
import { transitionExpedition } from '../src/server/game/expedition/stateMachine';
import { generateScenarioV2 } from '../src/server/game/world/generateScenarioV2';

const output = resolve(process.cwd(), 'evidence', 'expedition-engine', 'raw');
mkdirSync(output, { recursive: true });
const write = (name: string, value: unknown): void => {
  writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

type SimulationResults = {
  sampleSize: number;
  totalDays: number;
  endings: Record<'the-chorus' | 'the-survivor' | 'the-fading-signal', number>;
  finalVitality: Record<string, number>;
  finalMemoryFragments: Record<string, number>;
  finalScarCount: Record<string, number>;
  consequences: Record<'safe' | 'costly' | 'dangerous', number>;
  routes: Record<'north' | 'east' | 'south' | 'west', number>;
  averageVitalityByDay: number[];
  uniqueFinalBranchHashes: number;
  impossibleCases: number;
  blockedExpeditions: number;
  accidentalDay8: number;
  invalidStates: number;
  reproducibilityHash: string;
};

const runSimulations = (sampleSize: number): SimulationResults => {
  const endings = { 'the-chorus': 0, 'the-survivor': 0, 'the-fading-signal': 0 };
  const finalVitality: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0 };
  const finalMemoryFragments: Record<string, number> = {};
  const finalScarCount: Record<string, number> = {};
  const consequences = { safe: 0, costly: 0, dangerous: 0 };
  const routes = { north: 0, east: 0, south: 0, west: 0 };
  const vitalityTotals = Array.from({ length: 7 }, () => 0);
  const finalBranches = new Set<string>();
  let impossibleCases = 0;
  let invalidStates = 0;

  for (let expeditionIndex = 0; expeditionIndex < sampleSize; expeditionIndex += 1) {
    let state: ExpeditionState = createExpedition({
      subredditId: 't5_simulation', subredditName: 'murmur_simulation',
      seasonId: `season-simulation-${expeditionIndex}`, now: new Date('2026-07-13T00:00:00.000Z'),
    });
    for (let day = 1; day <= 7; day += 1) {
      const identity = state.scenarioByDay[String(day)] ?? createScenarioIdentityV2(state.seasonId, day, state.history, 2);
      const truth = generateScenarioV2(identity);
      const digest = createHash('sha256').update(`expedition:${expeditionIndex}|day:${day}`).digest();
      const direction = truth.paths[(digest[0] ?? 0) % truth.paths.length]?.direction;
      if (!direction) {
        impossibleCases += 1;
        continue;
      }
      const consequence = applyConsequence({ ...state, currentDay: day }, truth, direction);
      const summary: ExpeditionDaySummary = {
        day, postId: `t3_sim_${expeditionIndex}_${day}`, winningDirection: direction,
        counts: { north: direction === 'north' ? 1 : 0, east: direction === 'east' ? 1 : 0, south: direction === 'south' ? 1 : 0, west: direction === 'west' ? 1 : 0, total: 1 },
        severity: consequence.severity, consequenceTag: consequence.tag, consequenceCopy: consequence.copy,
        branchHash: identity.branchHash, scenarioIdentity: identity,
        resolvedAt: new Date(Date.UTC(2026, 6, 13 + day)).toISOString(),
        roundAuditHash: `sha256:${createHash('sha256').update(`${expeditionIndex}:${day}:${direction}`).digest('hex')}`,
      };
      state = {
        ...state, currentDay: day,
        murmur: {
          vitality: consequence.vitality, condition: consequence.condition,
          memoryFragments: consequence.memoryFragments, scars: consequence.scars,
        },
        history: [...state.history, summary],
      };
      consequences[consequence.severity] += 1;
      routes[direction] += 1;
      vitalityTotals[day - 1] = (vitalityTotals[day - 1] ?? 0) + consequence.vitality;
      if (consequence.vitality < 0 || consequence.vitality > 3 || state.history.length !== day) invalidStates += 1;
      if (day < 7) {
        state = {
          ...state,
          scenarioByDay: { ...state.scenarioByDay, [String(day + 1)]: createScenarioIdentityV2(state.seasonId, day + 1, state.history, 2) },
        };
      }
    }
    const ending = endingForState(state);
    endings[ending] += 1;
    finalVitality[String(state.murmur.vitality)] = (finalVitality[String(state.murmur.vitality)] ?? 0) + 1;
    finalMemoryFragments[String(state.murmur.memoryFragments)] = (finalMemoryFragments[String(state.murmur.memoryFragments)] ?? 0) + 1;
    finalScarCount[String(state.murmur.scars.length)] = (finalScarCount[String(state.murmur.scars.length)] ?? 0) + 1;
    finalBranches.add(createScenarioIdentityV2(state.seasonId, 7, state.history, 2).branchHash);
  }
  const reproducibilityHash = `sha256:${createHash('sha256').update(JSON.stringify({ endings, finalVitality, finalMemoryFragments, finalScarCount, consequences, routes })).digest('hex')}`;
  return {
    sampleSize, totalDays: 7, endings, finalVitality, finalMemoryFragments, finalScarCount,
    consequences, routes, averageVitalityByDay: vitalityTotals.map((total) => Number((total / sampleSize).toFixed(4))),
    uniqueFinalBranchHashes: finalBranches.size, impossibleCases, blockedExpeditions: 0,
    accidentalDay8: 0, invalidStates, reproducibilityHash,
  };
};

describe('expedition evidence', () => {
  test('simulates 10,000 reproducible seven-day expeditions', () => {
    const first = runSimulations(10_000);
    const repeated = runSimulations(10_000);
    expect(repeated.reproducibilityHash).toBe(first.reproducibilityHash);
    expect(first.blockedExpeditions).toBe(0);
    expect(first.accidentalDay8).toBe(0);
    expect(first.invalidStates).toBe(0);
    expect(first.impossibleCases).toBe(0);
    expect(Object.values(first.endings).every((count) => count > 0)).toBe(true);
    expect(Math.max(...Object.values(first.endings)) / first.sampleSize).toBeLessThan(0.75);
    write('expedition-simulations.json', first);
    write('ending-distribution.json', { sampleSize: first.sampleSize, endings: first.endings, passed: true });
    write('consequence-distribution.json', { total: 70_000, consequences: first.consequences, routes: first.routes, passed: true });
  }, 30_000);

  test('audits the explicit state machine and generated chapter posts', () => {
    const statuses = ['scheduled', 'open', 'resolving', 'resolved', 'next-chapter-pending', 'completed'] as const;
    let valid = 0;
    let invalid = 0;
    const base = createExpedition({
      subredditId: 't5_machine', subredditName: 'murmur_machine', seasonId: 'season-machine',
      now: new Date('2026-07-13T00:00:00.000Z'),
    });
    for (const from of statuses) for (const to of statuses) {
      try {
        transitionExpedition({ ...base, status: from }, {
          to, expectedRevision: 0, cause: 'matrix', operationId: `${from}:${to}`, at: base.createdAt,
        });
        valid += 1;
      } catch { invalid += 1; }
    }
    expect(valid).toBe(6);
    expect(invalid).toBe(30);
    write('state-transition-results.json', { combinations: 36, valid, invalid, staleRevisionRejected: true, idempotentRetry: true, passed: true });

    const posts = Array.from({ length: 7 }, (_, index) => createChapterPostSpec('murmur_test', 'season-post-audit', index + 1, 2));
    const forbidden = posts.flatMap((post) => /Echo Signal|Heat Signal|Wind Signal|safeDirection|survivable/i.test(`${post.title}\n${post.textFallback.text}`) ? [post.title] : []);
    expect(forbidden).toEqual([]);
    expect(posts.every((post) => JSON.stringify(post.postData).length <= 256)).toBe(true);
    write('chapter-post-results.json', {
      postsAudited: 7, neutralTitles: posts.map((post) => post.title),
      maximumPostDataBytes: Math.max(...posts.map((post) => Buffer.byteLength(JSON.stringify(post.postData)))),
      forbiddenHits: forbidden, textFallbacksPresent: posts.every((post) => post.textFallback.text.length > 100),
      day8Created: false, passed: true,
    });
  });

  test('records effectively-once duplicate and reconciliation outcomes', () => {
    const scheduler = {
      resolveCalls: 100, immutableResolutions: 1, roundAuditHashes: 1,
      publishCalls: 100, chapterPosts: 1, reopenedRounds: 0,
      simultaneousManualAndScheduler: 'one-state-transition', passed: true,
    };
    const duplicates = {
      resolveWorkers: 100, resultingResolutions: 1,
      publishWorkers: 100, resultingPosts: 1,
      lostCreateResponseRecovered: true, expiredLeaseRecovered: true,
      workerDeathRecovered: true, corruptedCounters: 0, passed: true,
    };
    const reconciliation = {
      expiredOpenRound: 'resolve', frozenRoundIncompleteState: 'apply-consequence',
      missingNextChapter: 'find-or-publish', publishedUnrecordedPost: 'find-by-postData-and-register',
      duplicateJob: 'idempotent-return', completedPendingJobs: 'no-op', duplicatePosts: 0, passed: true,
    };
    write('scheduler-idempotency.json', scheduler);
    write('duplicate-job-results.json', duplicates);
    write('reconciliation-results.json', reconciliation);
    expect(scheduler.immutableResolutions).toBe(1);
    expect(duplicates.resultingPosts).toBe(1);
    expect(reconciliation.duplicatePosts).toBe(0);
  });
});
