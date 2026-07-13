import type { RoundWindow } from '../../../shared/contracts/expedition';

export type WindowProfile = {
  openDurationMs: number;
  revealDelayMs: number;
  nextChapterDelayMs: number;
};

export const PRODUCTION_WINDOW: WindowProfile = {
  openDurationMs: 22 * 60 * 60 * 1_000,
  revealDelayMs: 2 * 60 * 1_000,
  nextChapterDelayMs: 10 * 60 * 1_000,
};

export const TEST_WINDOW: WindowProfile = {
  openDurationMs: 2 * 60 * 1_000,
  revealDelayMs: 5 * 1_000,
  nextChapterDelayMs: 15 * 1_000,
};

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
