import { describe, expect, it } from 'vitest';
import { normalizeDirection } from '../src/shared/types/game';

describe('direction normalization', () => {
  it.each([
    [' North ', 'north'],
    ['E', 'east'],
    ['south', 'south'],
    ['w', 'west'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeDirection(input)).toBe(expected);
  });

  it.each(['down', '', 42, null, undefined])('rejects %s', (input) => {
    expect(normalizeDirection(input)).toBeNull();
  });
});

