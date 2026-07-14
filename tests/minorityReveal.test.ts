import { expect, test } from 'vitest';
import { computeMinorityInsight, type MinorityNote } from '../src/server/game/fieldNotes/minority';

const note = (direction: MinorityNote['direction'], sensor: MinorityNote['sensor']): MinorityNote => ({ direction, sensor });

test('the chorus held when the community chose the optimal path', () => {
  const insight = computeMinorityInsight('north', 'north', [note('north', 'echo'), note('south', 'heat')]);
  expect(insight.communityWasCorrect).toBe(true);
  expect(insight.minorityWasCorrect).toBe(false);
  expect(insight.verdict).toBe('chorus-held');
});

test('the minority heard it when a correct minority warned of danger', () => {
  const notes = [note('north', 'echo'), note('south', 'heat'), note('east', 'wind'), note('west', 'echo')];
  const insight = computeMinorityInsight('north', 'south', notes);
  expect(insight.minorityWasCorrect).toBe(true);
  expect(insight.correctNoteCount).toBe(1);
  expect(insight.totalNoteCount).toBe(4);
  expect(insight.correctNoteShare).toBeCloseTo(0.25);
  expect(insight.verdict).toBe('minority-heard');
  expect(insight.participatingSensors).toEqual(['echo', 'heat', 'wind']);
});

test('no notes or too few notes keeps the hollow secret', () => {
  expect(computeMinorityInsight('north', 'south', []).verdict).toBe('hollow-kept-secret');
  expect(computeMinorityInsight('north', 'south', [note('north', 'echo')]).verdict).toBe('hollow-kept-secret');
});

test('a correct majority of notes is not a minority reveal', () => {
  const notes = [note('north', 'echo'), note('north', 'heat'), note('north', 'wind'), note('south', 'echo')];
  const insight = computeMinorityInsight('north', 'south', notes);
  expect(insight.correctNoteShare).toBeCloseTo(0.75);
  expect(insight.minorityWasCorrect).toBe(false);
  expect(insight.verdict).toBe('hollow-kept-secret');
});

test('the insight exposes no identity fields', () => {
  const insight = computeMinorityInsight('east', 'west', [note('east', 'heat'), note('west', 'echo'), note('north', 'wind')]);
  expect(Object.keys(insight)).not.toContain('voterHash');
  expect(Object.keys(insight)).not.toContain('userId');
  expect(JSON.stringify(insight)).not.toMatch(/t2_|voter/);
});
