import { describe, expect, test } from 'vitest';
import { generateScenario } from '../src/server/game/world/generateScenario';
import { projectEcho } from '../src/server/game/sensors/projectEcho';
import { projectHeat } from '../src/server/game/sensors/projectHeat';
import { projectWind } from '../src/server/game/sensors/projectWind';
import { parsePlayerPerception } from '../src/shared/contracts/session';

const truth = generateScenario({ postId: 't3_projection', chapter: 1, day: 1, generatorVersion: 1 });
const forbidden = ['survivable', 'safeDirection', 'correctDirection', 'worldTruth', 'worldSeed', 'outcome', 'userId', 'username', 'voterHash'];
const keysDeep = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
};

describe('safe perception projections', () => {
  test('constructs three valid discriminated payloads without forbidden keys', () => {
    for (const projection of [projectEcho(truth), projectHeat(truth), projectWind(truth)]) {
      expect(parsePlayerPerception(projection)).toEqual(projection);
      expect(keysDeep(projection).filter((key) => forbidden.includes(key))).toEqual([]);
    }
  });

  test('Echo contains structure and no thermal or airflow fields', () => {
    const keys = keysDeep(projectEcho(truth));
    expect(keys).toContain('structuralSignals');
    expect(keys).not.toContain('thermalSignals');
    expect(keys).not.toContain('airflowSignals');
    expect(keys).not.toContain('temperature');
    expect(keys).not.toContain('flow');
  });

  test('Heat contains thermal information and no structure or airflow fields', () => {
    const keys = keysDeep(projectHeat(truth));
    expect(keys).toContain('thermalSignals');
    expect(keys).not.toContain('structuralSignals');
    expect(keys).not.toContain('airflowSignals');
    expect(keys).not.toContain('cavity');
    expect(keys).not.toContain('flow');
  });

  test('Wind contains airflow information and no structure or thermal fields', () => {
    const keys = keysDeep(projectWind(truth));
    expect(keys).toContain('airflowSignals');
    expect(keys).not.toContain('structuralSignals');
    expect(keys).not.toContain('thermalSignals');
    expect(keys).not.toContain('cavity');
    expect(keys).not.toContain('temperature');
  });

  test('rejects an unknown or incompatible projection', () => {
    expect(parsePlayerPerception({ sensor: 'void', schemaVersion: 1 })).toBeNull();
    expect(parsePlayerPerception({ ...projectEcho(truth), schemaVersion: 999 })).toBeNull();
  });
});
