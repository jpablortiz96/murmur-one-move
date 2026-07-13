import type { ConsequenceSeverity } from '../../../shared/contracts/expedition';
import type { CommunityCounts } from '../../../shared/contracts/round';
import type { Direction } from '../../../shared/types/game';
import { getChapter } from './chapters';
import type { PostReferenceV2 } from './expeditionTypes';

export type ChapterPostSpec = {
  subredditName: string;
  title: string;
  entry: 'default';
  postData: PostReferenceV2;
  textFallback: { text: string };
};

export const createChapterTitle = (day: number): string =>
  `MURMUR — Day ${day}: ${getChapter(day).name}`;

export const createOpenFallback = (day: number): string => {
  const chapter = getChapter(day);
  return [
    `# MURMUR — Day ${day}: ${chapter.name}`,
    '',
    '**Everyone sees a different truth. The subreddit gets one move.**',
    '',
    chapter.phrase,
    '',
    'Enter the Interactive Post, listen through your assigned sense, compare clues with the community, and help choose Murmur’s next move.',
    '',
    'The community has one move before this hollow closes. This post is part of a seven-day expedition.',
  ].join('\n');
};

export const createChapterPostSpec = (
  subredditName: string,
  seasonId: string,
  day: number,
  generatorVersion: number
): ChapterPostSpec => ({
  subredditName,
  title: createChapterTitle(day),
  entry: 'default',
  postData: { murmur: { v: 2, seasonId, day, generatorVersion } },
  textFallback: { text: createOpenFallback(day) },
});

export const createResolvedFallback = (input: {
  day: number;
  direction: Direction;
  counts: CommunityCounts;
  severity: ConsequenceSeverity;
  consequence: string;
  nextPostId?: string;
}): string => {
  const next = input.nextPostId
    ? `Continue to the next chapter: https://reddit.com/comments/${input.nextPostId.replace(/^t3_/, '')}`
    : input.day === 7 ? 'The seven-day expedition has reached its final resonance.' : 'The next hollow is being prepared.';
  return [
    `# MURMUR — Day ${input.day} resolved`, '',
    `The community chose **${input.direction.toUpperCase()}** with ${input.counts.total} signals.`, '',
    `Consequence: **${input.severity.toUpperCase()}** — ${input.consequence}`, '',
    'Echo, Heat, and Wind each held only part of the answer.', '', next,
  ].join('\n');
};
