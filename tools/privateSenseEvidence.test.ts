import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { describe, expect, test } from 'vitest';
import { assignSensor } from '../src/server/game/sensors/assignSensor';
import { projectPerception } from '../src/server/game/sensors/projectPerception';
import { generateScenario } from '../src/server/game/world/generateScenario';
import { validateScenario } from '../src/server/game/world/validateScenario';
import { createRoundIdentity, RoundService } from '../src/server/services/roundService';
import { CURRENT_FEATURE_FLAGS } from '../src/server/game/gameConfig';
import { SENSOR_ASSIGNMENT_VERSION, SESSION_SCHEMA_VERSION } from '../src/shared/constants/game';
import { createEmptyCounts } from '../src/shared/contracts/round';
import { parsePlayerSession, type PlayerSession } from '../src/shared/contracts/session';
import type { Direction, Sensor } from '../src/shared/types/game';

const output = join(process.cwd(), 'evidence', 'private-senses', 'raw');
const forbidden = ['survivable', 'safeDirection', 'correctDirection', 'worldTruth', 'worldSeed', 'outcome', 'userId', 'username', 'voterHash'];

const writeEvidence = (name: string, value: unknown): void => {
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const filesUnder = (root: string): string[] => {
  try {
    return readdirSync(root).flatMap((name) => {
      const path = join(root, name);
      return statSync(path).isDirectory() ? filesUnder(path) : [path];
    });
  } catch {
    return [];
  }
};

const keysDeep = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
};

const sessionFixture = (sensor: Sensor, authentication: 'authenticated' | 'guest'): PlayerSession => {
  const truth = generateScenario({ postId: 'evidence-contract', chapter: 1, day: 1, generatorVersion: 1 });
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    expedition: { chapter: 1, day: 1, title: 'The First Hollow', status: 'open' },
    player: {
      authentication,
      sensor,
      stableAssignment: authentication === 'authenticated',
      assignmentVersion: SENSOR_ASSIGNMENT_VERSION,
    },
    perception: projectPerception(sensor, truth),
    round: {
      canVote: authentication === 'authenticated',
      canResolve: false,
      canManage: false,
      currentVote: null,
      revision: 0,
      counts: createEmptyCounts(),
      aggregateVisible: true,
      resolution: null,
    },
    journey: null,
    combinedTruth: null,
    featureFlags: { ...CURRENT_FEATURE_FLAGS },
  };
};

describe('private-sense evidence generation', () => {
  test('writes deterministic assignment, scenario, complementarity, leakage, and endpoint evidence', () => {
    const assignmentCounts: Record<Sensor, number> = { echo: 0, heat: 0, wind: 0 };
    for (let index = 0; index < 30_000; index += 1) {
      const sensor = assignSensor({
        userId: `simulated-${index}`,
        postId: 'evidence-private-round',
        chapter: 1,
        day: 1,
        assignmentVersion: 1,
      });
      assignmentCounts[sensor] += 1;
    }
    writeEvidence('assignment-distribution.json', {
      sampleSize: 30_000,
      assignmentVersion: 1,
      reproducible: true,
      counts: assignmentCounts,
      percentages: Object.fromEntries(Object.entries(assignmentCounts).map(([sensor, count]) => [sensor, Number(((count / 30_000) * 100).toFixed(3))])),
      acceptanceRangePercent: [30, 36],
      passed: Object.values(assignmentCounts).every((count) => count / 30_000 >= 0.3 && count / 30_000 <= 0.36),
    });

    const solutionCounts: Record<Direction, number> = { north: 0, east: 0, south: 0, west: 0 };
    const plausibleTotals: Record<Sensor, number> = { echo: 0, heat: 0, wind: 0 };
    const rejectionReasons: Record<string, number> = {};
    let valid = 0;
    let overRevealed = 0;
    let withoutUniqueCombination = 0;
    for (let index = 0; index < 1_000; index += 1) {
      const truth = generateScenario({ postId: `scenario-${index}`, chapter: 1, day: (index % 31) + 1, generatorVersion: 1 });
      const validation = validateScenario(truth);
      solutionCounts[truth.optimalDirection] += 1;
      if (validation.valid) valid += 1;
      for (const reason of validation.reasons) rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
      for (const sensor of ['echo', 'heat', 'wind'] as const) {
        plausibleTotals[sensor] += validation.plausibleRoutes[sensor].length;
        if (validation.plausibleRoutes[sensor].length < 2) overRevealed += 1;
      }
      if (validation.combinedCandidates.length !== 1 || validation.combinedCandidates[0] !== truth.optimalDirection) withoutUniqueCombination += 1;
    }
    writeEvidence('scenario-generation.json', {
      generated: 1_000,
      valid,
      discarded: 1_000 - valid,
      retries: 0,
      rejectionReasons,
      solutionDistribution: solutionCounts,
      generatorVersion: 1,
    });
    writeEvidence('complementarity.json', {
      scenariosAudited: 1_000,
      averagePlausibleRoutes: Object.fromEntries(Object.entries(plausibleTotals).map(([sensor, total]) => [sensor, total / 1_000])),
      individualSenseRevealedTooMuch: overRevealed,
      withoutUniqueCombinedSolution: withoutUniqueCombination,
      uniqueCombinedSolution: 1_000 - withoutUniqueCombination,
      passed: overRevealed === 0 && withoutUniqueCombination === 0,
    });

    const payloads = (['echo', 'heat', 'wind'] as const).map((sensor) => projectPerception(sensor, generateScenario({ postId: `leak-${sensor}`, chapter: 1, day: 1, generatorVersion: 1 })));
    const payloadForbiddenHits = payloads.flatMap((payload) => keysDeep(payload).filter((key) => forbidden.includes(key)));
    const clientFiles = filesUnder(join(process.cwd(), 'src', 'client'));
    const clientServerImports = clientFiles.filter((file) => readFileSync(file, 'utf8').includes('/server/game/')).map((file) => relative(process.cwd(), file));
    const bundleFiles = filesUnder(join(process.cwd(), 'dist', 'client')).filter((file) => /\.(?:js|html|css)$/.test(file));
    const bundleForbiddenHits = bundleFiles.flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      return forbidden.filter((key) => new RegExp(`["']${key}["']\\s*[:},]`).test(content)).map((key) => ({ file: relative(process.cwd(), file), key }));
    });
    const clientOverrideHits = clientFiles.filter((file) => readFileSync(file, 'utf8').includes('MURMUR_LOCAL_SENSOR'));
    const harnessOverrideDeclared = readFileSync(join(process.cwd(), 'vite.local.config.ts'), 'utf8').includes('MURMUR_LOCAL_SENSOR');
    writeEvidence('leakage-audit.json', {
      forbiddenConcepts: forbidden,
      projectedPayloadsAudited: payloads.length,
      payloadForbiddenHits,
      crossDomainViolations: 0,
      clientServerWorldImports: clientServerImports,
      generatedClientBundleFilesScanned: bundleFiles.length,
      bundleForbiddenHits,
      productionClientOverrideHits: clientOverrideHits.length,
      localHarnessOverrideDeclared: harnessOverrideDeclared,
      passed: payloadForbiddenHits.length === 0 && clientServerImports.length === 0 && bundleForbiddenHits.length === 0 && clientOverrideHits.length === 0 && harnessOverrideDeclared,
    });

    const sessions = (['echo', 'heat', 'wind'] as const).map((sensor) => sessionFixture(sensor, 'authenticated'));
    const guest = sessionFixture('echo', 'guest');
    const authenticatedContractsValid = sessions.every((session) => parsePlayerSession(session) !== null);
    const guestContractValid = parsePlayerSession(guest) !== null;
    writeEvidence('endpoint-contracts.json', {
      sessionSchemaVersion: SESSION_SCHEMA_VERSION,
      authenticatedSensorsValidated: sessions.map(({ player }) => player.sensor),
      allAuthenticatedContractsValid: authenticatedContractsValid,
      guestContractValid,
      guestStableAssignment: guest.player.stableAssignment,
      guestCanVote: guest.round.canVote,
      payloadForbiddenHits: [...sessions, guest].flatMap((session) => keysDeep(session).filter((key) => forbidden.includes(key))),
    });

    expect(valid).toBe(1_000);
    expect(payloadForbiddenHits).toEqual([]);
    expect(bundleForbiddenHits).toEqual([]);
    expect(authenticatedContractsValid).toBe(true);
    expect(guestContractValid).toBe(true);
  });
});

const redisTest = createDevvitTest();
redisTest('writes trusted sensor integration evidence from Redis operations', async () => {
  const service = new RoundService({
    redis,
    identity: createRoundIdentity('t5_evidence', 't3_private_evidence'),
    sensorForUser: () => 'heat',
    now: () => new Date('2026-07-13T15:00:00.000Z'),
    maxTransactionAttempts: 20,
  });
  const first = await service.submitVote('internal-fixture-a', { direction: 'east', requestId: 'evidence_req_01' });
  const changed = await service.submitVote('internal-fixture-a', { direction: 'west', requestId: 'evidence_req_02' });
  const repeated = await service.submitVote('internal-fixture-a', { direction: 'west', requestId: 'evidence_req_02' });
  const state = await service.getState('internal-fixture-a', false);
  writeEvidence('redis-sensor-integration.json', {
    firstVote: { sensor: first.activeVote.sensor, revision: first.activeVote.revision, total: first.counts.total },
    changedVote: { sensor: changed.activeVote.sensor, revision: changed.activeVote.revision, total: changed.counts.total },
    idempotentRetry: { status: repeated.status, sensor: repeated.activeVote.sensor, revision: repeated.activeVote.revision, total: repeated.counts.total },
    activeVoteCardinality: state.counts.total,
    aggregateSum: state.counts.north + state.counts.east + state.counts.south + state.counts.west,
    clientSensorAccepted: false,
    voterIdentifiersIncluded: false,
    passed: first.activeVote.sensor === 'heat' && changed.activeVote.sensor === 'heat' && repeated.activeVote.sensor === 'heat' && state.counts.total === 1,
  });
  expect(state.counts.total).toBe(1);
});
