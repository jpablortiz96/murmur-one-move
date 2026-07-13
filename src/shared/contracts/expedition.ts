import type { CommunityCounts, RoundResolution } from './round';
import type { Direction } from '../types/game';

export const EXPEDITION_DAYS = 7 as const;

export const EXPEDITION_STATUSES = [
  'scheduled',
  'open',
  'resolving',
  'resolved',
  'next-chapter-pending',
  'completed',
] as const;

export type ExpeditionStatus = (typeof EXPEDITION_STATUSES)[number];
export type MurmurCondition = 'radiant' | 'stable' | 'strained' | 'fading';
export type ConsequenceSeverity = 'safe' | 'costly' | 'dangerous';
export type ConsequenceTag =
  | 'fractured-shell'
  | 'thermal-burn'
  | 'spore-mark'
  | 'echo-memory'
  | 'clean-breath'
  | 'living-ember';
export type ExpeditionEnding = 'the-chorus' | 'the-survivor' | 'the-fading-signal';

export type RoundWindow = {
  opensAt: string;
  closesAt: string;
  revealAt: string;
  nextChapterAt: string;
};

export type PublicChapter = {
  day: number;
  name: string;
  phrase: string;
  cavernType: string;
  cliffhanger: string;
};

export type PublicMurmurState = {
  vitality: number;
  condition: MurmurCondition;
  memoryFragments: number;
  scars: ConsequenceTag[];
};

export type PublicDaySummary = {
  day: number;
  direction: Direction;
  severity: ConsequenceSeverity;
  consequence: string;
  resolvedAt: string;
};

export type CombinedTruth = {
  echo: string;
  heat: string;
  wind: string;
  consequence: string;
  severity: ConsequenceSeverity;
};

export type ExpeditionPublicView = {
  schemaVersion: 2;
  seasonId: string;
  status: ExpeditionStatus;
  currentDay: number;
  totalDays: 7;
  chapter: PublicChapter;
  window: RoundWindow;
  murmur: PublicMurmurState;
  history: PublicDaySummary[];
  ending: ExpeditionEnding | null;
  schedulerDelayed: boolean;
  nextChapterPostId: string | null;
};

export type ExpeditionRoundView = {
  counts: CommunityCounts;
  resolution: RoundResolution | null;
  combinedTruth: CombinedTruth | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export const parseRoundWindow = (value: unknown): RoundWindow | null => {
  if (!isRecord(value)) return null;
  if (
    !isTimestamp(value.opensAt) ||
    !isTimestamp(value.closesAt) ||
    !isTimestamp(value.revealAt) ||
    !isTimestamp(value.nextChapterAt)
  ) return null;
  return {
    opensAt: value.opensAt,
    closesAt: value.closesAt,
    revealAt: value.revealAt,
    nextChapterAt: value.nextChapterAt,
  };
};

export const isExpeditionStatus = (value: unknown): value is ExpeditionStatus =>
  typeof value === 'string' && EXPEDITION_STATUSES.some((status) => status === value);

export const isMurmurCondition = (value: unknown): value is MurmurCondition =>
  value === 'radiant' || value === 'stable' || value === 'strained' || value === 'fading';

export const isConsequenceSeverity = (value: unknown): value is ConsequenceSeverity =>
  value === 'safe' || value === 'costly' || value === 'dangerous';

export const isConsequenceTag = (value: unknown): value is ConsequenceTag =>
  typeof value === 'string' && [
    'fractured-shell', 'thermal-burn', 'spore-mark',
    'echo-memory', 'clean-breath', 'living-ember',
  ].includes(value);

export const parsePublicMurmurState = (value: unknown): PublicMurmurState | null => {
  if (!isRecord(value) || !Number.isInteger(value.vitality) || !Number.isInteger(value.memoryFragments)) return null;
  if (
    typeof value.vitality !== 'number' || value.vitality < 0 || value.vitality > 3 ||
    typeof value.memoryFragments !== 'number' || value.memoryFragments < 0 || value.memoryFragments > 7 ||
    !isMurmurCondition(value.condition) || !Array.isArray(value.scars) ||
    !value.scars.every(isConsequenceTag)
  ) return null;
  return {
    vitality: value.vitality,
    condition: value.condition,
    memoryFragments: value.memoryFragments,
    scars: [...value.scars],
  };
};

export const parseExpeditionPublicView = (value: unknown): ExpeditionPublicView | null => {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.chapter)) return null;
  const window = parseRoundWindow(value.window);
  const murmur = parsePublicMurmurState(value.murmur);
  if (
    typeof value.seasonId !== 'string' || value.seasonId.length < 8 ||
    !isExpeditionStatus(value.status) ||
    typeof value.currentDay !== 'number' || !Number.isInteger(value.currentDay) || value.currentDay < 1 || value.currentDay > 7 ||
    value.totalDays !== EXPEDITION_DAYS || window === null || murmur === null ||
    typeof value.chapter.day !== 'number' || value.chapter.day !== value.currentDay ||
    typeof value.chapter.name !== 'string' || typeof value.chapter.phrase !== 'string' ||
    typeof value.chapter.cavernType !== 'string' || typeof value.chapter.cliffhanger !== 'string' ||
    !Array.isArray(value.history) || typeof value.schedulerDelayed !== 'boolean' ||
    (value.nextChapterPostId !== null && typeof value.nextChapterPostId !== 'string') ||
    (value.ending !== null && value.ending !== 'the-chorus' && value.ending !== 'the-survivor' && value.ending !== 'the-fading-signal')
  ) return null;
  const history = value.history.map((item): PublicDaySummary | null => {
    if (!isRecord(item) || typeof item.day !== 'number' || !Number.isInteger(item.day) ||
      (item.direction !== 'north' && item.direction !== 'east' && item.direction !== 'south' && item.direction !== 'west') ||
      !isConsequenceSeverity(item.severity) || typeof item.consequence !== 'string' || !isTimestamp(item.resolvedAt)) return null;
    return { day: item.day, direction: item.direction, severity: item.severity, consequence: item.consequence, resolvedAt: item.resolvedAt };
  });
  if (history.some((item) => item === null)) return null;
  return {
    schemaVersion: 2,
    seasonId: value.seasonId,
    status: value.status,
    currentDay: value.currentDay,
    totalDays: 7,
    chapter: {
      day: value.chapter.day,
      name: value.chapter.name,
      phrase: value.chapter.phrase,
      cavernType: value.chapter.cavernType,
      cliffhanger: value.chapter.cliffhanger,
    },
    window,
    murmur,
    history: history as PublicDaySummary[],
    ending: value.ending,
    schedulerDelayed: value.schedulerDelayed,
    nextChapterPostId: value.nextChapterPostId,
  };
};

export const hasOnlySmallPostReference = (value: unknown): boolean => {
  if (!isRecord(value) || !isRecord(value.murmur)) return false;
  const keys = Object.keys(value.murmur).sort();
  return keys.join(',') === 'day,generatorVersion,seasonId,v' &&
    value.murmur.v === 2 && typeof value.murmur.seasonId === 'string' &&
    Number.isInteger(value.murmur.day) && Number.isInteger(value.murmur.generatorVersion) &&
    JSON.stringify(value).length <= 256 && !isStringArray(value.murmur.history);
};
