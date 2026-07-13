import type { ConsequenceSeverity, ConsequenceTag, ExpeditionEnding, MurmurCondition } from '../../../shared/contracts/expedition';
import type { Direction } from '../../../shared/types/game';
import type { WorldTruth } from '../world/worldTypes';
import { getChapter } from './chapters';
import type { ExpeditionState } from './expeditionTypes';

export type ConsequenceResult = {
  severity: ConsequenceSeverity;
  tag: ConsequenceTag;
  copy: string;
  vitality: number;
  memoryFragments: number;
  scars: ConsequenceTag[];
  condition: MurmurCondition;
};

export const conditionForVitality = (vitality: number, memoryFragments: number): MurmurCondition => {
  if (vitality === 0) return 'fading';
  if (vitality === 1) return 'strained';
  if (vitality === 3 && memoryFragments >= 3) return 'radiant';
  return 'stable';
};

export const endingForState = (state: Pick<ExpeditionState, 'murmur'>): ExpeditionEnding => {
  if (state.murmur.vitality === 0) return 'the-fading-signal';
  if (state.murmur.memoryFragments >= 5 && state.murmur.vitality >= 2) return 'the-chorus';
  return 'the-survivor';
};

export const severityForDirection = (truth: WorldTruth, direction: Direction): ConsequenceSeverity => {
  const path = truth.paths.find((candidate) => candidate.direction === direction);
  if (!path) throw new Error('Resolved direction is absent from World Truth');
  if (path.outcome.survivable) return 'safe';
  if (path.outcome.consequenceId === 'spore-sleep') return 'costly';
  return 'dangerous';
};

export const applyConsequence = (
  state: ExpeditionState,
  truth: WorldTruth,
  direction: Direction
): ConsequenceResult => {
  const severity = severityForDirection(truth, direction);
  const outcome = getChapter(state.currentDay).outcomes[severity];
  const vitalityLoss = severity === 'safe' ? 0 : 1;
  const vitality = Math.max(0, Math.min(3, state.murmur.vitality - vitalityLoss));
  const memoryFragments = Math.min(7, state.murmur.memoryFragments + (severity === 'safe' ? 1 : 0));
  const scars = state.murmur.scars.includes(outcome.scar)
    ? [...state.murmur.scars]
    : [...state.murmur.scars, outcome.scar];
  return {
    severity,
    tag: outcome.scar,
    copy: outcome.copy,
    vitality,
    memoryFragments,
    scars,
    condition: conditionForVitality(vitality, memoryFragments),
  };
};
