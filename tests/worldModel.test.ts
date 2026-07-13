import { describe, expect, test } from 'vitest';
import { WORLD_GENERATOR_VERSION } from '../src/shared/constants/game';
import { generateScenario } from '../src/server/game/world/generateScenario';
import { validateScenario } from '../src/server/game/world/validateScenario';
import type { WorldTruth } from '../src/server/game/world/worldTypes';

const identity = (postId: string, day = 1) => ({
  postId,
  chapter: 1,
  day,
  generatorVersion: WORLD_GENERATOR_VERSION,
});

describe('server-only scenario generation', () => {
  test('is deterministic and changes across stable identities', () => {
    expect(generateScenario(identity('t3_same'))).toEqual(generateScenario(identity('t3_same')));
    const scenarios = new Set(Array.from({ length: 20 }, (_, index) =>
      JSON.stringify(generateScenario(identity(`t3_${index}`, index + 1)))
    ));
    expect(scenarios.size).toBeGreaterThan(4);
  });

  test('audits 1,000 valid complementary scenarios with balanced solutions', () => {
    const counts = { north: 0, east: 0, south: 0, west: 0 };
    for (let index = 0; index < 1_000; index += 1) {
      const world = generateScenario(identity(`t3_audit_${index}`, (index % 31) + 1));
      const result = validateScenario(world);
      expect(result.valid, result.reasons.join('; ')).toBe(true);
      expect(result.plausibleRoutes.echo.length).toBeGreaterThanOrEqual(2);
      expect(result.plausibleRoutes.heat.length).toBeGreaterThanOrEqual(2);
      expect(result.plausibleRoutes.wind.length).toBeGreaterThanOrEqual(2);
      expect(result.combinedCandidates).toEqual([world.optimalDirection]);
      counts[world.optimalDirection] += 1;
    }
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThanOrEqual(210);
      expect(count).toBeLessThanOrEqual(290);
    }
  });

  test('rejects an invalid scenario instead of projecting it', () => {
    const world = generateScenario(identity('t3_invalid'));
    const invalid: WorldTruth = {
      ...world,
      paths: world.paths.map((path) => ({ ...path, outcome: { ...path.outcome, survivable: true } })),
    };
    const result = validateScenario(invalid);
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('scenario must contain exactly one coherent optimal path');
  });
});
