import type { ConsequenceSeverity, ConsequenceTag } from '../../../shared/contracts/expedition';

export type ChapterDefinition = {
  day: number;
  name: string;
  phrase: string;
  cavernType: string;
  environmentalRule: string;
  intensity: number;
  outcomes: Record<ConsequenceSeverity, { copy: string; scar: ConsequenceTag }>;
  cliffhanger: string;
  scarVariations: Partial<Record<ConsequenceTag, string>>;
};

const outcomes = (
  safe: string,
  costly: string,
  dangerous: string,
  costlyScar: ConsequenceTag,
  dangerousScar: ConsequenceTag
): ChapterDefinition['outcomes'] => ({
  safe: { copy: safe, scar: 'echo-memory' },
  costly: { copy: costly, scar: costlyScar },
  dangerous: { copy: dangerous, scar: dangerousScar },
});

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    day: 1, name: 'The First Hollow', phrase: 'The stone answers before it opens.', cavernType: 'resonant cradle',
    environmentalRule: 'Distant surfaces repeat weak signals.', intensity: 1,
    outcomes: outcomes('Murmur crosses without waking the walls.', 'The passage leaves spores clinging to its wake.', 'The hollow folds against Murmur’s shell.', 'spore-mark', 'fractured-shell'),
    cliffhanger: 'Ahead, the wall breathes inward.', scarVariations: { 'thermal-burn': 'Old heat makes the breathing wall recoil.' },
  },
  {
    day: 2, name: 'The Breathing Wall', phrase: 'Every opening closes like a gill.', cavernType: 'living membrane',
    environmentalRule: 'Airflow changes as the chamber inhales.', intensity: 2,
    outcomes: outcomes('A clean current carries Murmur through.', 'The membrane tightens and takes a measure of light.', 'A burning fold brands the outer shell.', 'fractured-shell', 'thermal-burn'),
    cliffhanger: 'Something warm is sleeping below.', scarVariations: { 'clean-breath': 'The remembered current steadies the membrane.' },
  },
  {
    day: 3, name: 'The Sleeping Heat', phrase: 'Warmth moves where nothing should be alive.', cavernType: 'thermal nursery',
    environmentalRule: 'Living signatures drift between paths.', intensity: 2,
    outcomes: outcomes('Murmur borrows a quiet ember.', 'Heat drains the edge of its glow.', 'The nursery wakes and leaves a pulsing burn.', 'living-ember', 'thermal-burn'),
    cliffhanger: 'A choir begins without voices.', scarVariations: { 'living-ember': 'The borrowed ember answers the sleepers.' },
  },
  {
    day: 4, name: 'The Spore Choir', phrase: 'The air remembers every body it touched.', cavernType: 'suspended bloom',
    environmentalRule: 'Contamination travels in shaped currents.', intensity: 3,
    outcomes: outcomes('Clean breath parts the bloom.', 'A soft mark takes root along the shell.', 'The choir settles into Murmur’s fading light.', 'spore-mark', 'spore-mark'),
    cliffhanger: 'The current ahead has been broken.', scarVariations: { 'spore-mark': 'The choir recognizes its earlier mark.' },
  },
  {
    day: 5, name: 'The Broken Current', phrase: 'Every wind returns from the wrong direction.', cavernType: 'torn pressure organ',
    environmentalRule: 'Crosscurrents mask the true outlet.', intensity: 3,
    outcomes: outcomes('A clean breath becomes part of Murmur.', 'The current fractures an old line wider.', 'Violent air extinguishes the outer halo.', 'clean-breath', 'fractured-shell'),
    cliffhanger: 'The next chamber already knows Murmur’s shape.', scarVariations: { 'fractured-shell': 'The broken current whistles through the fracture.' },
  },
  {
    day: 6, name: 'The Chamber That Remembers', phrase: 'Old signals return wearing new shapes.', cavernType: 'mnemonic cavity',
    environmentalRule: 'Past scars alter ambient patterns, never the valid solution.', intensity: 4,
    outcomes: outcomes('A lost signal returns as memory.', 'The chamber repeats Murmur’s weakest moment.', 'Every scar resonates at once.', 'echo-memory', 'fractured-shell'),
    cliffhanger: 'One resonance remains beyond the dark.', scarVariations: { 'echo-memory': 'The chamber opens around a remembered pulse.' },
  },
  {
    day: 7, name: 'The Last Resonance', phrase: 'Three truths gather around one final passage.', cavernType: 'convergence organ',
    environmentalRule: 'All accumulated history colors the final consequence.', intensity: 5,
    outcomes: outcomes('The cavern answers as a chorus.', 'Murmur crosses carrying every mark.', 'A final signal leaves the hollow before the light fades.', 'echo-memory', 'thermal-burn'),
    cliffhanger: 'The signal continues somewhere unseen.', scarVariations: { 'echo-memory': 'Every remembered fragment hums in alignment.' },
  },
] as const;

export const getChapter = (day: number): ChapterDefinition => {
  const chapter = CHAPTERS.find((candidate) => candidate.day === day);
  if (!chapter) throw new RangeError(`MURMUR expedition has no Day ${day}`);
  return chapter;
};
