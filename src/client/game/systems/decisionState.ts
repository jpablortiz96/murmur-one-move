import { MAX_ECHO_PULSES } from '../../../shared/constants/game';
import type { Direction } from '../../../shared/types/game';

export type DecisionState = {
  phase: 'observing' | 'decided';
  pulsesUsed: number;
  maxPulses: number;
  selection: Direction | null;
};

export const createDecisionState = (): DecisionState => ({
  phase: 'observing',
  pulsesUsed: 0,
  maxPulses: MAX_ECHO_PULSES,
  selection: null,
});

export const canEmitPulse = (state: DecisionState): boolean =>
  state.phase === 'observing' && state.pulsesUsed < state.maxPulses;

export const emitPulse = (state: DecisionState): DecisionState => {
  if (!canEmitPulse(state)) return state;
  return { ...state, pulsesUsed: state.pulsesUsed + 1 };
};

export const selectDirection = (
  state: DecisionState,
  direction: Direction
): DecisionState => {
  if (state.pulsesUsed < 1) return state;
  return { ...state, phase: 'decided', selection: direction };
};

export const changeChoice = (state: DecisionState): DecisionState => ({
  ...state,
  phase: 'observing',
  selection: null,
});

export const replaySignal = (): DecisionState => createDecisionState();

