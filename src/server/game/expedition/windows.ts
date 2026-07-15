import type { RoundWindow } from '../../../shared/contracts/expedition';

export type WindowProfile = {
  openDurationMs: number;
  revealDelayMs: number;
  nextChapterDelayMs: number;
};

/** The only community that receives the accelerated development profile. */
export const TEST_SUBREDDIT = 'murmur_one_move_dev';

export const PRODUCTION_WINDOW: WindowProfile = {
  openDurationMs: 22 * 60 * 60 * 1_000,
  revealDelayMs: 2 * 60 * 1_000,
  nextChapterDelayMs: 10 * 60 * 1_000,
};

/**
 * The development profile must leave a human enough time to complete a sense,
 * vote, open the Field Note composer and reach the preview while inspecting the
 * interface. The previous two-minute window closed the round mid-playtest, so it
 * is 15 minutes. Production is unchanged.
 */
export const TEST_WINDOW: WindowProfile = {
  openDurationMs: 15 * 60 * 1_000,
  revealDelayMs: 5 * 1_000,
  nextChapterDelayMs: 15 * 1_000,
};

/** Single source of truth for which community gets which window profile. */
export const windowProfileForSubreddit = (subredditName: string | undefined): WindowProfile =>
  subredditName === TEST_SUBREDDIT ? TEST_WINDOW : PRODUCTION_WINDOW;

export const createRoundWindow = (opensAt: Date, profile: WindowProfile): RoundWindow => {
  const closesAt = new Date(opensAt.getTime() + profile.openDurationMs);
  const revealAt = new Date(closesAt.getTime() + profile.revealDelayMs);
  const nextChapterAt = new Date(revealAt.getTime() + profile.nextChapterDelayMs);
  return {
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    revealAt: revealAt.toISOString(),
    nextChapterAt: nextChapterAt.toISOString(),
  };
};
