import { expect, test } from 'vitest';
import {
  guidanceFor,
  helpFor,
  INTRO_INSTRUCTION,
  shouldShowIntro,
} from '../src/client/game/presentation/sensorGuidance';
import type { Sensor } from '../src/shared/types/game';

const SENSORS: Sensor[] = ['echo', 'heat', 'wind'];

test('the full instruction stays before any activation, for every sense', () => {
  expect(shouldShowIntro(0)).toBe(true);
  expect(guidanceFor('echo', 0)).toBe('Tap the cavern to send an echo.');
  expect(guidanceFor('heat', 0)).toBe('Press and hold to focus the heat.');
  expect(guidanceFor('wind', 0)).toBe('Drag across the cavern to release tracers.');
});

test('the first activation compacts the instruction but never removes it', () => {
  expect(shouldShowIntro(1)).toBe(false);
  expect(guidanceFor('echo', 1)).toBe('Tap again · 1 of 3');
  expect(guidanceFor('heat', 1)).toBe('Hold to focus · 1 of 3');
  expect(guidanceFor('wind', 1)).toBe('Drag to trace · 1 of 3');
});

test('progress reads 1 of 3, 2 of 3 and 3 of 3', () => {
  expect(guidanceFor('heat', 1)).toContain('1 of 3');
  expect(guidanceFor('heat', 2)).toContain('2 of 3');
  expect(guidanceFor('heat', 3)).toContain('3 of 3');
  expect(guidanceFor('heat', 3)).toContain('complete');
});

test('guidance is never empty in any state', () => {
  for (const sensor of SENSORS) {
    for (let used = 0; used <= 3; used += 1) {
      expect(guidanceFor(sensor, used).length).toBeGreaterThan(0);
    }
  }
});

test('HOW TO SENSE restores the gesture, the remaining activations and what the sense offers', () => {
  const help = helpFor('heat', 1);
  expect(help).toContain(INTRO_INSTRUCTION.heat);
  expect(help).toContain('2 of 3 activations remain');
  expect(help).toContain('Heat reveals warmth');
  expect(helpFor('heat', 3)).toContain('No activations remain');
});

test('help never reveals another sense or the route', () => {
  for (const sensor of SENSORS) {
    for (let used = 0; used <= 3; used += 1) {
      const help = helpFor(sensor, used);
      const others = SENSORS.filter((candidate) => candidate !== sensor);
      for (const other of others) {
        expect(help.toLowerCase()).not.toContain(`${other} reveals`);
      }
      expect(help).not.toMatch(/optimal|survivable|safe route|winner|north|east|south|west/i);
    }
  }
});

test('guidance depends only on interaction, so reduced motion cannot shorten reading time', () => {
  // There is no timing input at all: the same activation count always yields the
  // same guidance, which is what removed the 1.8s disappearing timer.
  expect(guidanceFor('wind', 0)).toBe(guidanceFor('wind', 0));
  expect(guidanceFor('wind', 0)).not.toBe(guidanceFor('wind', 1));
});
