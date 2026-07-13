import { AVAILABLE_DIRECTIONS } from '../../../shared/constants/game';
import type { Direction } from '../../../shared/types/game';
import type { HiddenPathTruth, ScenarioValidation, WorldTruth } from './worldTypes';

const echoPlausible = (path: HiddenPathTruth): boolean =>
  path.structure.continuity !== 'blocked' && path.structure.stability !== 'collapsing';
const heatPlausible = (path: HiddenPathTruth): boolean =>
  path.thermal.temperature !== 'burning' && path.thermal.volatility !== 'rising';
const windPlausible = (path: HiddenPathTruth): boolean =>
  path.airflow.contamination === 'clear' && path.airflow.strength !== 'violent';

export const plausibleRoutesForWorld = (world: WorldTruth): Record<'echo' | 'heat' | 'wind', Direction[]> => ({
  echo: world.paths.filter(echoPlausible).map(({ direction }) => direction),
  heat: world.paths.filter(heatPlausible).map(({ direction }) => direction),
  wind: world.paths.filter(windPlausible).map(({ direction }) => direction),
});

export const validateScenario = (world: WorldTruth): ScenarioValidation => {
  const reasons: string[] = [];
  const directions = new Set(world.paths.map(({ direction }) => direction));
  if (world.paths.length !== 4 || directions.size !== 4 || !AVAILABLE_DIRECTIONS.every((direction) => directions.has(direction))) {
    reasons.push('scenario must contain each direction exactly once');
  }
  const survivable = world.paths.filter(({ outcome }) => outcome.survivable);
  if (survivable.length !== 1 || survivable[0]?.direction !== world.optimalDirection) {
    reasons.push('scenario must contain exactly one coherent optimal path');
  }
  const plausibleRoutes = plausibleRoutesForWorld(world);
  for (const sensor of ['echo', 'heat', 'wind'] as const) {
    if (plausibleRoutes[sensor].length < 2) reasons.push(`${sensor} reveals fewer than two plausible paths`);
  }
  const combinedCandidates = AVAILABLE_DIRECTIONS.filter((direction) =>
    plausibleRoutes.echo.includes(direction) && plausibleRoutes.heat.includes(direction) && plausibleRoutes.wind.includes(direction)
  );
  if (combinedCandidates.length !== 1 || combinedCandidates[0] !== world.optimalDirection) {
    reasons.push('combined perceptions do not identify one coherent path');
  }
  return { valid: reasons.length === 0, reasons, plausibleRoutes, combinedCandidates };
};
