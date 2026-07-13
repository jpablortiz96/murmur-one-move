import {
  AVAILABLE_DIRECTIONS,
  AVAILABLE_SENSORS,
  ROUND_RESOLUTION_VERSION,
  ROUND_SCHEMA_VERSION,
} from '../constants/game';
import type { Direction, Sensor } from '../types/game';

export type RoundStatus = 'open' | 'resolving' | 'resolved';

export type RoundIdentity = {
  installationKey: string;
  postId: string;
  chapter: number;
  day: number;
  schemaVersion: number;
};

export type ActiveVote = {
  direction: Direction;
  sensor: Sensor;
  signalQuality: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type CommunityCounts = Record<Direction, number> & {
  total: number;
};

export type TieBreak =
  | 'vote-count'
  | 'sensor-diversity'
  | 'deterministic-seed';

export type RoundResolution = {
  status: 'resolved';
  winningDirection: Direction;
  countsSnapshot: CommunityCounts;
  sensorDiversityByDirection: Record<Direction, number>;
  tieBreak: TieBreak;
  tiedDirections: Direction[];
  resolvedAt: string;
  resolutionVersion: number;
  auditHash: string;
};

export type RoundViewer = {
  authenticated: boolean;
  canVote: boolean;
  canResolve: boolean;
  sensor: Sensor;
  activeVote: ActiveVote | null;
};

export type RoundStateResponse = {
  schemaVersion: number;
  chapter: number;
  day: number;
  status: RoundStatus;
  counts: CommunityCounts;
  resolution: RoundResolution | null;
  viewer: RoundViewer;
};

export type SubmitVoteRequest = {
  direction: Direction;
  requestId: string;
};

export type SubmitVoteResponse = {
  status: 'recorded' | 'unchanged' | 'idempotent';
  activeVote: ActiveVote;
  counts: CommunityCounts;
  roundStatus: 'open';
};

export type ResolveRoundResponse = {
  status: 'resolved';
  alreadyResolved: boolean;
  resolution: RoundResolution;
};

export type RoundApiErrorCode =
  | 'invalid-request'
  | 'authentication-required'
  | 'moderator-required'
  | 'round-resolved'
  | 'idempotency-conflict'
  | 'round-unavailable'
  | 'storage-failure';

export type RoundApiError = {
  status: 'error';
  code: RoundApiErrorCode;
  message: string;
};

export const createEmptyCounts = (): CommunityCounts => ({
  north: 0,
  east: 0,
  south: 0,
  west: 0,
  total: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAllowed = <T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T =>
  typeof value === 'string' && allowed.some((candidate) => candidate === value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

export const parseSubmitVoteRequest = (value: unknown): SubmitVoteRequest | null => {
  if (!isRecord(value)) return null;
  if (!isAllowed(value.direction, AVAILABLE_DIRECTIONS)) return null;
  if (
    typeof value.requestId !== 'string' ||
    value.requestId.length < 8 ||
    value.requestId.length > 100 ||
    !/^[A-Za-z0-9_-]+$/.test(value.requestId)
  ) {
    return null;
  }
  return { direction: value.direction, requestId: value.requestId };
};

export const parseActiveVote = (value: unknown): ActiveVote | null => {
  if (!isRecord(value)) return null;
  if (
    !isAllowed(value.direction, AVAILABLE_DIRECTIONS) ||
    !isAllowed(value.sensor, AVAILABLE_SENSORS) ||
    typeof value.signalQuality !== 'number' ||
    !Number.isFinite(value.signalQuality) ||
    value.signalQuality < 0 ||
    value.signalQuality > 1 ||
    typeof value.revision !== 'number' ||
    !Number.isInteger(value.revision) ||
    value.revision < 1 ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return null;
  }
  return {
    direction: value.direction,
    sensor: value.sensor,
    signalQuality: value.signalQuality,
    revision: value.revision,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const parseCommunityCounts = (value: unknown): CommunityCounts | null => {
  if (!isRecord(value)) return null;
  const fields = [...AVAILABLE_DIRECTIONS, 'total'] as const;
  if (
    !fields.every(
      (field) =>
        typeof value[field] === 'number' &&
        Number.isSafeInteger(value[field]) &&
        value[field] >= 0
    )
  ) {
    return null;
  }
  const { north, east, south, west, total } = value;
  if (
    typeof north !== 'number' ||
    typeof east !== 'number' ||
    typeof south !== 'number' ||
    typeof west !== 'number' ||
    typeof total !== 'number'
  ) {
    return null;
  }
  const counts: CommunityCounts = { north, east, south, west, total };
  const sum = AVAILABLE_DIRECTIONS.reduce(
    (total, direction) => total + counts[direction],
    0
  );
  return sum === counts.total ? counts : null;
};

export const isSupportedRoundSchema = (value: number): boolean =>
  value === ROUND_SCHEMA_VERSION;

export const isSupportedResolutionVersion = (value: number): boolean =>
  value === ROUND_RESOLUTION_VERSION;

const parseSensorDiversity = (
  value: unknown
): Record<Direction, number> | null => {
  if (!isRecord(value)) return null;
  const counts = AVAILABLE_DIRECTIONS.map((direction) => value[direction]);
  if (
    !counts.every(
      (count) =>
        typeof count === 'number' &&
        Number.isSafeInteger(count) &&
        count >= 0
    )
  ) {
    return null;
  }
  const [north, east, south, west] = counts;
  if (
    typeof north !== 'number' ||
    typeof east !== 'number' ||
    typeof south !== 'number' ||
    typeof west !== 'number'
  ) {
    return null;
  }
  return { north, east, south, west };
};

export const parseRoundResolution = (value: unknown): RoundResolution | null => {
  if (!isRecord(value)) return null;
  const countsSnapshot = parseCommunityCounts(value.countsSnapshot);
  const sensorDiversityByDirection = parseSensorDiversity(
    value.sensorDiversityByDirection
  );
  const tiedDirectionsRaw = value.tiedDirections;
  const tiedDirections = Array.isArray(tiedDirectionsRaw)
    ? tiedDirectionsRaw.filter((direction): direction is Direction =>
        isAllowed(direction, AVAILABLE_DIRECTIONS)
      )
    : null;
  if (
    value.status !== 'resolved' ||
    !isAllowed(value.winningDirection, AVAILABLE_DIRECTIONS) ||
    countsSnapshot === null ||
    sensorDiversityByDirection === null ||
    (value.tieBreak !== 'vote-count' &&
      value.tieBreak !== 'sensor-diversity' &&
      value.tieBreak !== 'deterministic-seed') ||
    tiedDirections === null ||
    !Array.isArray(tiedDirectionsRaw) ||
    tiedDirections.length !== tiedDirectionsRaw.length ||
    !isTimestamp(value.resolvedAt) ||
    value.resolutionVersion !== ROUND_RESOLUTION_VERSION ||
    typeof value.auditHash !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(value.auditHash)
  ) {
    return null;
  }
  return {
    status: 'resolved',
    winningDirection: value.winningDirection,
    countsSnapshot,
    sensorDiversityByDirection,
    tieBreak: value.tieBreak,
    tiedDirections,
    resolvedAt: value.resolvedAt,
    resolutionVersion: value.resolutionVersion,
    auditHash: value.auditHash,
  };
};

const parseRoundStatus = (value: unknown): RoundStatus | null =>
  value === 'open' || value === 'resolving' || value === 'resolved' ? value : null;

export const parseRoundStateResponse = (value: unknown): RoundStateResponse | null => {
  if (!isRecord(value) || !isRecord(value.viewer)) return null;
  const status = parseRoundStatus(value.status);
  const counts = parseCommunityCounts(value.counts);
  const resolution = value.resolution === null ? null : parseRoundResolution(value.resolution);
  const activeVote =
    value.viewer.activeVote === null ? null : parseActiveVote(value.viewer.activeVote);
  if (
    value.schemaVersion !== ROUND_SCHEMA_VERSION ||
    typeof value.chapter !== 'number' ||
    !Number.isSafeInteger(value.chapter) ||
    value.chapter < 1 ||
    typeof value.day !== 'number' ||
    !Number.isSafeInteger(value.day) ||
    value.day < 1 ||
    status === null ||
    counts === null ||
    (status === 'resolved') !== (resolution !== null) ||
    typeof value.viewer.authenticated !== 'boolean' ||
    typeof value.viewer.canVote !== 'boolean' ||
    typeof value.viewer.canResolve !== 'boolean' ||
    !isAllowed(value.viewer.sensor, AVAILABLE_SENSORS) ||
    (value.viewer.activeVote !== null && activeVote === null)
  ) {
    return null;
  }
  return {
    schemaVersion: value.schemaVersion,
    chapter: value.chapter,
    day: value.day,
    status,
    counts,
    resolution,
    viewer: {
      authenticated: value.viewer.authenticated,
      canVote: value.viewer.canVote,
      canResolve: value.viewer.canResolve,
      sensor: value.viewer.sensor,
      activeVote,
    },
  };
};

export const parseSubmitVoteResponse = (value: unknown): SubmitVoteResponse | null => {
  if (!isRecord(value)) return null;
  const activeVote = parseActiveVote(value.activeVote);
  const counts = parseCommunityCounts(value.counts);
  if (
    (value.status !== 'recorded' &&
      value.status !== 'unchanged' &&
      value.status !== 'idempotent') ||
    activeVote === null ||
    counts === null ||
    value.roundStatus !== 'open'
  ) {
    return null;
  }
  return { status: value.status, activeVote, counts, roundStatus: 'open' };
};

export const parseResolveRoundResponse = (value: unknown): ResolveRoundResponse | null => {
  if (!isRecord(value)) return null;
  const resolution = parseRoundResolution(value.resolution);
  if (
    value.status !== 'resolved' ||
    typeof value.alreadyResolved !== 'boolean' ||
    resolution === null
  ) {
    return null;
  }
  return { status: 'resolved', alreadyResolved: value.alreadyResolved, resolution };
};
