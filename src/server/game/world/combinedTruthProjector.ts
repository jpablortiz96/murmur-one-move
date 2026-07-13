import type { CombinedTruth, ConsequenceSeverity } from '../../../shared/contracts/expedition';
import type { Direction } from '../../../shared/types/game';
import type { WorldTruth } from './worldTypes';

const words = (direction: Direction): string => direction[0]?.toUpperCase() + direction.slice(1);

export const projectCombinedTruth = (
  truth: WorldTruth,
  direction: Direction,
  severity: ConsequenceSeverity,
  consequence: string
): CombinedTruth => {
  const path = truth.paths.find((candidate) => candidate.direction === direction);
  if (!path) throw new Error('Resolved path is absent from World Truth');
  const label = words(direction);
  return {
    echo: `${label} was ${path.structure.continuity}, ${path.structure.cavity}, and ${path.structure.stability}.`,
    heat: `${label} held ${path.thermal.temperature} air with a ${path.thermal.signature} signature.`,
    wind: `${label} carried ${path.airflow.contamination} air in a ${path.airflow.flow} current.`,
    consequence,
    severity,
  };
};
