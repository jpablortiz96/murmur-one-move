import { expect, test } from 'vitest';
import {
  advance,
  autoAdvanceDelayMs,
  ctaFor,
  isTerminalStage,
  layersFor,
  moderatorTrayFor,
  RESOLUTION_SEQUENCE,
  type ResolutionPresentationState,
} from '../src/client/game/presentation/resolutionFlow';

test('every stage lights exactly one layer', () => {
  for (const stage of RESOLUTION_SEQUENCE) {
    const active = Object.values(layersFor(stage)).filter(Boolean);
    expect(active).toHaveLength(1);
  }
});

test('three truths, consequence and the map are never visible together', () => {
  for (const stage of RESOLUTION_SEQUENCE) {
    const layers = layersFor(stage);
    const overlapping = [layers.threeTruths, layers.consequence, layers.expeditionMap].filter(Boolean);
    expect(overlapping.length).toBeLessThanOrEqual(1);
  }
});

test('the sequence advances summary -> three truths -> consequence -> map -> next action', () => {
  let stage: ResolutionPresentationState = 'summary';
  const visited: ResolutionPresentationState[] = [stage];
  for (let step = 0; step < 4; step += 1) {
    stage = advance(stage);
    visited.push(stage);
  }
  expect(visited).toEqual(['summary', 'three-truths', 'consequence', 'expedition-map', 'next-action']);
});

test('the terminal stage never advances past itself', () => {
  expect(advance('next-action')).toBe('next-action');
  expect(isTerminalStage('next-action')).toBe(true);
  expect(isTerminalStage('summary')).toBe(false);
});

test('every non-terminal stage offers exactly one primary action', () => {
  for (const stage of RESOLUTION_SEQUENCE) {
    const cta = ctaFor(stage);
    if (isTerminalStage(stage)) expect(cta).toBeNull();
    else expect(typeof cta).toBe('string');
  }
});

test('reduced motion shortens the beat without skipping a stage', () => {
  expect(autoAdvanceDelayMs('summary', true)).toBeLessThan(autoAdvanceDelayMs('summary', false) ?? 0);
  // Every stage still exists under reduced motion.
  for (const stage of RESOLUTION_SEQUENCE) expect(layersFor(stage)).toBeDefined();
  // Stages that wait for the player never auto-advance.
  expect(autoAdvanceDelayMs('three-truths', false)).toBeNull();
  expect(autoAdvanceDelayMs('next-action', true)).toBeNull();
});

test('the moderator tray is closed by default and cannot exist for a normal player', () => {
  expect(moderatorTrayFor(true, false)).toEqual({ exists: true, open: false });
  expect(moderatorTrayFor(true, true)).toEqual({ exists: true, open: true });
  // A normal player has no tray, so it can never be open or capture input.
  expect(moderatorTrayFor(false, true)).toEqual({ exists: false, open: false });
});
