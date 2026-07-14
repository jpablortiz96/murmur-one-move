import { getChapter } from '../expedition/chapters';

/**
 * The single app-authored parent comment that hosts each chapter's Field Notes.
 * Neutral: it never names a sense, a winner or a correct route.
 */
export const createFieldNotesParentBody = (day: number): string => {
  const chapter = getChapter(day);
  return [
    `FIELD NOTES — DAY ${day}: ${chapter.name}`,
    '',
    'No one sees the whole cavern.',
    '',
    'Share what your sense revealed, compare interpretations, and help the community decide. Field Notes are optional and public.',
  ].join('\n');
};
