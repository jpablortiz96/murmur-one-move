import { describe, expect, test } from 'vitest';
import { CURRENT_FEATURE_FLAGS } from '../src/server/game/gameConfig';
import { projectPerception } from '../src/server/game/sensors/projectPerception';
import { generateScenario } from '../src/server/game/world/generateScenario';
import { createEmptyCounts } from '../src/shared/contracts/round';
import { parsePlayerSession, type PlayerSession } from '../src/shared/contracts/session';
import type { Sensor } from '../src/shared/types/game';

const truth = generateScenario({ postId: 't3_session_contract', chapter: 1, day: 1, generatorVersion: 1 });
const fixture = (sensor: Sensor): PlayerSession => ({
  schemaVersion: 2,
  expedition: { chapter: 1, day: 1, title: 'The First Hollow', status: 'open' },
  player: { authentication: 'authenticated', sensor, stableAssignment: true, assignmentVersion: 1 },
  perception: projectPerception(sensor, truth),
  round: {
    canVote: true,
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
});

describe('player session contract', () => {
  test('renders all three discriminated perception unions', () => {
    for (const sensor of ['echo', 'heat', 'wind'] as const) {
      expect(parsePlayerSession(fixture(sensor))?.perception.sensor).toBe(sensor);
    }
  });

  test('rejects a sensor mismatch and incompatible schema', () => {
    const echo = fixture('echo');
    expect(parsePlayerSession({ ...echo, player: { ...echo.player, sensor: 'heat' } })).toBeNull();
    expect(parsePlayerSession({ ...echo, schemaVersion: 99 })).toBeNull();
  });

  test('allows a guest demo only without stable assignment or voting', () => {
    const echo = fixture('echo');
    const guest = {
      ...echo,
      player: { ...echo.player, authentication: 'guest', stableAssignment: false },
      round: { ...echo.round, canVote: false },
    };
    expect(parsePlayerSession(guest)).not.toBeNull();
    expect(parsePlayerSession({ ...guest, round: { ...guest.round, canVote: true } })).toBeNull();
    expect(parsePlayerSession({ ...guest, player: { ...guest.player, stableAssignment: true } })).toBeNull();
  });
});
