/**
 * The post-resolution zone used to paint Three Truths, the expedition map, the
 * result line and the moderator controls at the same time, so on mobile the
 * reveal ellipse covered the action buttons. Presentation is now an explicit
 * sequence in which exactly one stage owns the main zone at a time.
 */
export type ResolutionPresentationState =
  | 'summary'
  | 'three-truths'
  | 'consequence'
  | 'expedition-map'
  | 'next-action';

export const RESOLUTION_SEQUENCE: readonly ResolutionPresentationState[] = [
  'summary',
  'three-truths',
  'consequence',
  'expedition-map',
  'next-action',
] as const;

/** Exactly one field is ever true. */
export type ResolutionLayers = {
  summary: boolean;
  threeTruths: boolean;
  consequence: boolean;
  expeditionMap: boolean;
  nextAction: boolean;
};

export const layersFor = (stage: ResolutionPresentationState): ResolutionLayers => ({
  summary: stage === 'summary',
  threeTruths: stage === 'three-truths',
  consequence: stage === 'consequence',
  expeditionMap: stage === 'expedition-map',
  nextAction: stage === 'next-action',
});

/** Label of the single primary action that advances the sequence. */
export const ctaFor = (stage: ResolutionPresentationState): string | null => {
  switch (stage) {
    case 'summary':
      return 'REVEAL THE THREE TRUTHS';
    case 'three-truths':
      return 'SEE THE CONSEQUENCE';
    case 'consequence':
      return 'VIEW THE EXPEDITION';
    case 'expedition-map':
      return 'CONTINUE';
    case 'next-action':
      return null;
  }
};

export const advance = (stage: ResolutionPresentationState): ResolutionPresentationState => {
  const index = RESOLUTION_SEQUENCE.indexOf(stage);
  return RESOLUTION_SEQUENCE[Math.min(index + 1, RESOLUTION_SEQUENCE.length - 1)] ?? 'next-action';
};

export const isTerminalStage = (stage: ResolutionPresentationState): boolean => stage === 'next-action';

/**
 * A stage may advance on its own after a short beat, but the player can always
 * advance manually. Reduced motion shortens the beat; it never drops a stage, so
 * no information is skipped.
 */
export const autoAdvanceDelayMs = (
  stage: ResolutionPresentationState,
  reducedMotion: boolean
): number | null => {
  if (stage === 'summary') return reducedMotion ? 700 : 1_700;
  return null;
};

/** Moderator controls live in a separate tray, closed by default. */
export type ModeratorTrayState = { exists: boolean; open: boolean };

export const moderatorTrayFor = (canManage: boolean, requestedOpen: boolean): ModeratorTrayState => ({
  exists: canManage,
  // A tray that does not exist can never be open, so it can never render or capture input.
  open: canManage && requestedOpen,
});
