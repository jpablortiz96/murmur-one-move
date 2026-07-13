import type { Direction } from '../../../shared/types/game';
import type { WorldTruth } from './worldTypes';

export type InternalConsequence = {
  direction: Direction;
  coherentWithScenario: boolean;
  internalConsequenceId: string;
};

export const projectInternalConsequence = (
  truth: WorldTruth,
  direction: Direction
): InternalConsequence => {
  const path = truth.paths.find((candidate) => candidate.direction === direction);
  if (!path) throw new Error('Resolved direction is absent from the scenario');
  return {
    direction,
    coherentWithScenario: path.outcome.survivable,
    internalConsequenceId: path.outcome.consequenceId,
  };
};
