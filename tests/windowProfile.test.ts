import { expect, test } from 'vitest';
import {
  PRODUCTION_WINDOW,
  TEST_SUBREDDIT,
  TEST_WINDOW,
  windowProfileForSubreddit,
} from '../src/server/game/expedition/windows';

test('only the development community receives the accelerated window', () => {
  expect(windowProfileForSubreddit(TEST_SUBREDDIT)).toBe(TEST_WINDOW);
  expect(windowProfileForSubreddit('murmur')).toBe(PRODUCTION_WINDOW);
  expect(windowProfileForSubreddit('murmur_one_move')).toBe(PRODUCTION_WINDOW);
  expect(windowProfileForSubreddit('MURMUR_ONE_MOVE_DEV')).toBe(PRODUCTION_WINDOW); // exact match only
  expect(windowProfileForSubreddit(undefined)).toBe(PRODUCTION_WINDOW);
});

test('the development window leaves a human time to reach a Field Note preview', () => {
  expect(TEST_WINDOW.openDurationMs).toBeGreaterThanOrEqual(10 * 60 * 1_000);
});

test('the production window is unchanged at about 22 hours', () => {
  expect(PRODUCTION_WINDOW.openDurationMs).toBe(22 * 60 * 60 * 1_000);
});
