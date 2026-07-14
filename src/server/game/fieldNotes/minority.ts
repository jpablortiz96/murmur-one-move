import { MINORITY_MIN_NOTES } from '../../../shared/constants/game';
import type { MinorityInsight } from '../../../shared/contracts/fieldNotes';
import type { Direction, Sensor } from '../../../shared/types/game';

export type MinorityNote = {
  direction: Direction;
  sensor: Sensor;
};

/**
 * Computes the correct-minority reveal from structured note metadata only — never
 * text or identity. The community vote never influences World Truth; this only
 * observes, after the fact, whether some active notes pointed at the optimal path.
 *
 * minorityWasCorrect is true when the community did not choose the optimal path,
 * at least one active note named the optimal path, and those correct notes were a
 * minority (<50%) of all active notes, with enough notes to be meaningful.
 */
export const computeMinorityInsight = (
  optimalDirection: Direction,
  communityDirection: Direction,
  notes: readonly MinorityNote[]
): MinorityInsight => {
  const totalNoteCount = notes.length;
  const correctNoteCount = notes.filter((note) => note.direction === optimalDirection).length;
  const correctNoteShare = totalNoteCount === 0 ? 0 : correctNoteCount / totalNoteCount;
  const communityWasCorrect = communityDirection === optimalDirection;
  const participatingSensors = [...new Set(notes.map((note) => note.sensor))].sort();

  const minorityWasCorrect =
    !communityWasCorrect &&
    correctNoteCount >= 1 &&
    totalNoteCount >= MINORITY_MIN_NOTES &&
    correctNoteShare < 0.5;

  const verdict: MinorityInsight['verdict'] = communityWasCorrect
    ? 'chorus-held'
    : minorityWasCorrect
      ? 'minority-heard'
      : 'hollow-kept-secret';

  return {
    communityDirection,
    optimalDirection,
    communityWasCorrect,
    correctNoteCount,
    totalNoteCount,
    correctNoteShare,
    minorityWasCorrect,
    participatingSensors,
    verdict,
  };
};
