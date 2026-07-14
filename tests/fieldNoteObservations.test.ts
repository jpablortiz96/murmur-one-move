import { expect, test } from 'vitest';
import {
  findObservationForSensor,
  getObservationsForSensor,
} from '../src/server/game/fieldNotes/observations';
import type { Sensor } from '../src/shared/types/game';

test('each sensor exposes four safe observation options', () => {
  (['echo', 'heat', 'wind'] as Sensor[]).forEach((sensor) => {
    const options = getObservationsForSensor(sensor);
    expect(options).toHaveLength(4);
    options.forEach((option) => {
      expect(option.id).toMatch(/^[a-z][a-z-]+$/);
      expect(option.label.length).toBeGreaterThan(0);
      expect(JSON.stringify(option)).not.toMatch(/clause/);
    });
  });
});

test('an observation is only found for its own sensor', () => {
  expect(findObservationForSensor('heat', 'moving-warmth')).not.toBeNull();
  expect(findObservationForSensor('echo', 'moving-warmth')).toBeNull(); // heat id under echo
  expect(findObservationForSensor('wind', 'deep-hollow')).toBeNull(); // echo id under wind
  expect(findObservationForSensor('heat', 'not-real')).toBeNull();
});
