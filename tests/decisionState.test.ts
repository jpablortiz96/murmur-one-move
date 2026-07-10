import { describe, expect, it } from 'vitest';
import {
  canEmitPulse,
  changeChoice,
  createDecisionState,
  emitPulse,
  replaySignal,
  selectDirection,
} from '../src/client/game/systems/decisionState';

describe('Echo decision state', () => {
  it('caps observation at three pulses', () => {
    let state = createDecisionState();
    state = emitPulse(state);
    state = emitPulse(state);
    state = emitPulse(state);
    state = emitPulse(state);

    expect(state.pulsesUsed).toBe(3);
    expect(canEmitPulse(state)).toBe(false);
  });

  it('requires a pulse before selecting a direction', () => {
    const untouched = createDecisionState();
    expect(selectDirection(untouched, 'north')).toEqual(untouched);

    const observed = emitPulse(untouched);
    expect(selectDirection(observed, 'east')).toMatchObject({
      phase: 'decided',
      selection: 'east',
    });
  });

  it('changes a choice without restoring pulses and replay resets all state', () => {
    const decided = selectDirection(emitPulse(createDecisionState()), 'west');
    const changed = changeChoice(decided);

    expect(changed).toMatchObject({ phase: 'observing', pulsesUsed: 1, selection: null });
    expect(replaySignal()).toEqual(createDecisionState());
  });
});

