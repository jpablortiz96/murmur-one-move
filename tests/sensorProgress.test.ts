import { describe, expect, test } from 'vitest';
import {
  activateSensorProgress,
  createSensorProgressState,
  resetSensorProgress,
} from '../src/client/game/systems/sensorProgress';

describe('sensor activation progress', () => {
  test('caps every sensor interaction at exactly three activations', () => {
    let state = createSensorProgressState();
    for (let index = 0; index < 10; index += 1) state = activateSensorProgress(state);
    expect(state).toEqual({ used: 3, maximum: 3 });
  });

  test('reset restores a complete replay budget', () => {
    const used = activateSensorProgress(activateSensorProgress(createSensorProgressState()));
    expect(used.used).toBe(2);
    expect(resetSensorProgress()).toEqual({ used: 0, maximum: 3 });
  });
});
