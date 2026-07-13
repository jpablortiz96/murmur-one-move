import { createHash } from 'node:crypto';
import { AVAILABLE_DIRECTIONS } from '../../../shared/constants/game';
import type { Direction } from '../../../shared/types/game';
import type { ScenarioIdentityV2 } from '../expedition/expeditionTypes';
import { createPathForRole, type PathRole } from './scenarioRules';
import type { WorldTruth } from './worldTypes';

export const canonicalScenarioIdentityV2 = (identity: ScenarioIdentityV2): string =>
  `season:${identity.seasonId}|day:${identity.day}|branch:${identity.branchHash}|generator:${identity.generatorVersion}`;

const rotate = <T>(values: readonly T[], offset: number): T[] =>
  values.map((_, index) => values[(index + offset) % values.length] as T);

export const generateScenarioV2 = (identity: ScenarioIdentityV2): WorldTruth => {
  const digest = createHash('sha256').update(canonicalScenarioIdentityV2(identity)).digest();
  const optimalIndex = (digest[0] ?? 0) % AVAILABLE_DIRECTIONS.length;
  const directions = rotate<Direction>(AVAILABLE_DIRECTIONS, optimalIndex);
  const remainingRoles: PathRole[] = ['structural-decoy', 'ambiguous', 'immediate-danger'];
  const rotatedRoles = rotate(remainingRoles, (digest[1] ?? 0) % remainingRoles.length);
  const optimalDirection = directions[0];
  if (!optimalDirection) throw new Error('Scenario V2 direction set is empty');
  return {
    generatorVersion: identity.generatorVersion,
    optimalDirection,
    paths: directions.map((direction, index) =>
      createPathForRole(direction, (['optimal', ...rotatedRoles] as PathRole[])[index] ?? 'immediate-danger')
    ),
  };
};
