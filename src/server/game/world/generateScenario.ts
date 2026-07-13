import { AVAILABLE_DIRECTIONS } from '../../../shared/constants/game';
import type { Direction } from '../../../shared/types/game';
import { createPathForRole, type PathRole } from './scenarioRules';
import { scenarioDigest } from './scenarioIdentity';
import type { ScenarioIdentity, WorldTruth } from './worldTypes';

const rotate = <T>(values: readonly T[], offset: number): T[] =>
  values.map((_, index) => values[(index + offset) % values.length] as T);

export const generateScenario = (identity: ScenarioIdentity): WorldTruth => {
  const digest = scenarioDigest(identity);
  const optimalIndex = (digest[0] ?? 0) % AVAILABLE_DIRECTIONS.length;
  const directions = rotate<Direction>(AVAILABLE_DIRECTIONS, optimalIndex);
  const remainingRoles: PathRole[] = ['structural-decoy', 'ambiguous', 'immediate-danger'];
  const rotatedRoles = rotate(remainingRoles, (digest[1] ?? 0) % remainingRoles.length);
  const roles: PathRole[] = ['optimal', ...rotatedRoles];
  const optimalDirection = directions[0];
  if (optimalDirection === undefined) throw new Error('Scenario direction set is empty');
  return {
    generatorVersion: identity.generatorVersion,
    optimalDirection,
    paths: directions.map((direction, index) =>
      createPathForRole(direction, roles[index] ?? 'immediate-danger')
    ),
  };
};
