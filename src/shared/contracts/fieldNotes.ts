import {
  AVAILABLE_DIRECTIONS,
  AVAILABLE_SENSORS,
  FIELD_NOTE_MAX_COMMENTARY,
  FIELD_NOTE_SCHEMA_VERSION,
  NOTE_CONFIDENCES,
} from '../constants/game';
import type { Direction, Sensor } from '../types/game';

export type NoteConfidence = (typeof NOTE_CONFIDENCES)[number];
export type FieldNotePublishMode = 'native' | 'fallback';
export type MinorityVerdict = 'chorus-held' | 'minority-heard' | 'hollow-kept-secret';

/**
 * The only shape a client may submit to `/api/field-notes/preview`. Sensor,
 * identity, season, post and the allowed observation vocabulary are all derived
 * server-side; the client can never send or force them.
 */
export type FieldNoteDraft = {
  direction: Direction;
  confidence: NoteConfidence;
  observationId: string;
  commentary?: string;
};

/** A composer menu entry for the caller's own sensor. The body fragment stays server-side. */
export type SensorObservationOption = {
  id: string;
  label: string;
};

export type FieldNotePreview = {
  schemaVersion: number;
  body: string;
  destination: { postId: string; commentsUrl: string; parentKnown: boolean };
  publishMode: FieldNotePublishMode;
  authorName: string | null;
  token: string;
  expiresAt: string;
};

export type PublishFieldNoteRequest = {
  token: string;
  requestId: string;
};

export type PublishFieldNoteResponse =
  | {
      status: 'published';
      mode: 'native';
      alreadyPublished: boolean;
      authorName: string;
      commentUrl: string | null;
    }
  | { status: 'copy-ready'; mode: 'fallback'; body: string; commentsUrl: string | null }
  | { status: 'already-active'; mode: FieldNotePublishMode };

export type FieldNoteBoard = {
  totalNotes: number;
  thresholdMet: boolean;
  bySensor: Record<Sensor, number> | null;
  byDirection: Record<Direction, number> | null;
};

export type MinorityInsight = {
  communityDirection: Direction;
  optimalDirection: Direction;
  communityWasCorrect: boolean;
  correctNoteCount: number;
  totalNoteCount: number;
  correctNoteShare: number;
  minorityWasCorrect: boolean;
  participatingSensors: Sensor[];
  verdict: MinorityVerdict;
};

export type FieldNotesView = {
  schemaVersion: number;
  enabled: boolean;
  publishMode: FieldNotePublishMode;
  authenticated: boolean;
  hasVoted: boolean;
  canContribute: boolean;
  alreadyContributed: boolean;
  sensor: Sensor | null;
  observations: SensorObservationOption[];
  authorName: string | null;
  commentsUrl: string | null;
  parentThreadUrl: string | null;
  board: FieldNoteBoard | null;
  minorityInsight: MinorityInsight | null;
};

export type FieldNoteApiError = {
  status: 'error';
  code:
    | 'invalid-request'
    | 'authentication-required'
    | 'vote-required'
    | 'round-closed'
    | 'cross-sensor'
    | 'invalid-observation'
    | 'invalid-commentary'
    | 'invalid-token'
    | 'already-active'
    | 'field-notes-disabled'
    | 'unavailable';
  message: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAllowed = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.some((candidate) => candidate === value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

export type CommentaryValidation =
  | { ok: true; value: string | undefined }
  | { ok: false; reason: string };

/**
 * Pure, transport-safe commentary validation shared by the composer (for UX)
 * and the server (authoritative). NFC-normalizes, forbids control/format
 * characters, caps length, allows at most one URL and rejects layout-breaking
 * markdown and long repeated-character spam.
 */
export const validateCommentary = (raw: unknown): CommentaryValidation => {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== 'string') return { ok: false, reason: 'Commentary must be text' };
  const normalized = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return { ok: true, value: undefined };
  if (normalized.length > FIELD_NOTE_MAX_COMMENTARY) {
    return { ok: false, reason: `Commentary must be ${FIELD_NOTE_MAX_COMMENTARY} characters or fewer` };
  }
  if (/[\p{Cc}\p{Cf}]/u.test(normalized)) {
    return { ok: false, reason: 'Commentary contains disallowed control characters' };
  }
  if (/(.)\1{9,}/u.test(normalized)) {
    return { ok: false, reason: 'Commentary repeats a character too many times' };
  }
  const urlMatches = normalized.match(/https?:\/\//gi);
  if (urlMatches && urlMatches.length > 1) {
    return { ok: false, reason: 'Commentary may contain at most one link' };
  }
  if (/\]\(|!\[|```|<\/?[a-z]/i.test(normalized)) {
    return { ok: false, reason: 'Commentary contains disallowed markup' };
  }
  return { ok: true, value: normalized };
};

export const parseFieldNoteDraft = (value: unknown): FieldNoteDraft | null => {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set(['direction', 'confidence', 'observationId', 'commentary']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  if (
    !isAllowed(value.direction, AVAILABLE_DIRECTIONS) ||
    !isAllowed(value.confidence, NOTE_CONFIDENCES) ||
    typeof value.observationId !== 'string' ||
    !/^[a-z][a-z-]{1,40}$/.test(value.observationId)
  ) {
    return null;
  }
  const commentary = validateCommentary(value.commentary);
  if (!commentary.ok) return null;
  const draft: FieldNoteDraft = {
    direction: value.direction,
    confidence: value.confidence,
    observationId: value.observationId,
  };
  if (commentary.value !== undefined) draft.commentary = commentary.value;
  return draft;
};

export const parsePublishFieldNoteRequest = (value: unknown): PublishFieldNoteRequest | null => {
  if (!isRecord(value)) return null;
  if (Object.keys(value).sort().join(',') !== 'requestId,token') return null;
  if (
    typeof value.token !== 'string' ||
    value.token.length < 16 ||
    value.token.length > 4096 ||
    typeof value.requestId !== 'string' ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(value.requestId)
  ) {
    return null;
  }
  return { token: value.token, requestId: value.requestId };
};

const parseObservationOptions = (value: unknown): SensorObservationOption[] | null => {
  if (!Array.isArray(value)) return null;
  const options = value.map((item): SensorObservationOption | null =>
    isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string'
      ? { id: item.id, label: item.label }
      : null
  );
  return options.every((item): item is SensorObservationOption => item !== null) ? options : null;
};

const parseCountRecord = <K extends string>(value: unknown, keys: readonly K[]): Record<K, number> | null => {
  if (!isRecord(value)) return null;
  const entries = keys.map((key) => [key, value[key]] as const);
  if (!entries.every(([, count]) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)) {
    return null;
  }
  return Object.fromEntries(entries) as Record<K, number>;
};

export const parseFieldNoteBoard = (value: unknown): FieldNoteBoard | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.totalNotes !== 'number' ||
    !Number.isSafeInteger(value.totalNotes) ||
    value.totalNotes < 0 ||
    typeof value.thresholdMet !== 'boolean'
  ) {
    return null;
  }
  const bySensor = value.bySensor === null ? null : parseCountRecord(value.bySensor, AVAILABLE_SENSORS);
  const byDirection = value.byDirection === null ? null : parseCountRecord(value.byDirection, AVAILABLE_DIRECTIONS);
  if ((value.bySensor !== null && bySensor === null) || (value.byDirection !== null && byDirection === null)) {
    return null;
  }
  return { totalNotes: value.totalNotes, thresholdMet: value.thresholdMet, bySensor, byDirection };
};

export const parseMinorityInsight = (value: unknown): MinorityInsight | null => {
  if (!isRecord(value)) return null;
  const participating = Array.isArray(value.participatingSensors)
    ? value.participatingSensors.filter((item): item is Sensor => isAllowed(item, AVAILABLE_SENSORS))
    : null;
  if (
    !isAllowed(value.communityDirection, AVAILABLE_DIRECTIONS) ||
    !isAllowed(value.optimalDirection, AVAILABLE_DIRECTIONS) ||
    typeof value.communityWasCorrect !== 'boolean' ||
    typeof value.correctNoteCount !== 'number' ||
    !Number.isSafeInteger(value.correctNoteCount) ||
    value.correctNoteCount < 0 ||
    typeof value.totalNoteCount !== 'number' ||
    !Number.isSafeInteger(value.totalNoteCount) ||
    value.totalNoteCount < 0 ||
    typeof value.correctNoteShare !== 'number' ||
    !Number.isFinite(value.correctNoteShare) ||
    value.correctNoteShare < 0 ||
    value.correctNoteShare > 1 ||
    typeof value.minorityWasCorrect !== 'boolean' ||
    participating === null ||
    !Array.isArray(value.participatingSensors) ||
    participating.length !== value.participatingSensors.length ||
    (value.verdict !== 'chorus-held' && value.verdict !== 'minority-heard' && value.verdict !== 'hollow-kept-secret')
  ) {
    return null;
  }
  return {
    communityDirection: value.communityDirection,
    optimalDirection: value.optimalDirection,
    communityWasCorrect: value.communityWasCorrect,
    correctNoteCount: value.correctNoteCount,
    totalNoteCount: value.totalNoteCount,
    correctNoteShare: value.correctNoteShare,
    minorityWasCorrect: value.minorityWasCorrect,
    participatingSensors: participating,
    verdict: value.verdict,
  };
};

export const parseFieldNotePreview = (value: unknown): FieldNotePreview | null => {
  if (!isRecord(value) || !isRecord(value.destination)) return null;
  if (
    value.schemaVersion !== FIELD_NOTE_SCHEMA_VERSION ||
    typeof value.body !== 'string' ||
    value.body.length === 0 ||
    typeof value.destination.postId !== 'string' ||
    typeof value.destination.commentsUrl !== 'string' ||
    typeof value.destination.parentKnown !== 'boolean' ||
    (value.publishMode !== 'native' && value.publishMode !== 'fallback') ||
    (value.authorName !== null && typeof value.authorName !== 'string') ||
    typeof value.token !== 'string' ||
    !isTimestamp(value.expiresAt)
  ) {
    return null;
  }
  return {
    schemaVersion: FIELD_NOTE_SCHEMA_VERSION,
    body: value.body,
    destination: {
      postId: value.destination.postId,
      commentsUrl: value.destination.commentsUrl,
      parentKnown: value.destination.parentKnown,
    },
    publishMode: value.publishMode,
    authorName: value.authorName,
    token: value.token,
    expiresAt: value.expiresAt,
  };
};

export const parsePublishFieldNoteResponse = (value: unknown): PublishFieldNoteResponse | null => {
  if (!isRecord(value)) return null;
  if (value.status === 'published') {
    if (
      value.mode !== 'native' ||
      typeof value.alreadyPublished !== 'boolean' ||
      typeof value.authorName !== 'string' ||
      (value.commentUrl !== null && typeof value.commentUrl !== 'string')
    ) {
      return null;
    }
    return {
      status: 'published',
      mode: 'native',
      alreadyPublished: value.alreadyPublished,
      authorName: value.authorName,
      commentUrl: value.commentUrl,
    };
  }
  if (value.status === 'copy-ready') {
    if (
      value.mode !== 'fallback' ||
      typeof value.body !== 'string' ||
      (value.commentsUrl !== null && typeof value.commentsUrl !== 'string')
    ) {
      return null;
    }
    return { status: 'copy-ready', mode: 'fallback', body: value.body, commentsUrl: value.commentsUrl };
  }
  if (value.status === 'already-active') {
    if (value.mode !== 'native' && value.mode !== 'fallback') return null;
    return { status: 'already-active', mode: value.mode };
  }
  return null;
};

export const parseFieldNotesView = (value: unknown): FieldNotesView | null => {
  if (!isRecord(value)) return null;
  const observations = parseObservationOptions(value.observations);
  const board = value.board === null ? null : parseFieldNoteBoard(value.board);
  const minorityInsight = value.minorityInsight === null ? null : parseMinorityInsight(value.minorityInsight);
  if (
    value.schemaVersion !== FIELD_NOTE_SCHEMA_VERSION ||
    typeof value.enabled !== 'boolean' ||
    (value.publishMode !== 'native' && value.publishMode !== 'fallback') ||
    typeof value.authenticated !== 'boolean' ||
    typeof value.hasVoted !== 'boolean' ||
    typeof value.canContribute !== 'boolean' ||
    typeof value.alreadyContributed !== 'boolean' ||
    (value.sensor !== null && !isAllowed(value.sensor, AVAILABLE_SENSORS)) ||
    observations === null ||
    (value.authorName !== null && typeof value.authorName !== 'string') ||
    (value.commentsUrl !== null && typeof value.commentsUrl !== 'string') ||
    (value.parentThreadUrl !== null && typeof value.parentThreadUrl !== 'string') ||
    (value.board !== null && board === null) ||
    (value.minorityInsight !== null && minorityInsight === null)
  ) {
    return null;
  }
  return {
    schemaVersion: FIELD_NOTE_SCHEMA_VERSION,
    enabled: value.enabled,
    publishMode: value.publishMode,
    authenticated: value.authenticated,
    hasVoted: value.hasVoted,
    canContribute: value.canContribute,
    alreadyContributed: value.alreadyContributed,
    sensor: value.sensor,
    observations,
    authorName: value.authorName,
    commentsUrl: value.commentsUrl,
    parentThreadUrl: value.parentThreadUrl,
    board,
    minorityInsight,
  };
};
