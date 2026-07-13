import {
  AVAILABLE_DIRECTIONS,
  AVAILABLE_SENSORS,
  PERCEPTION_SCHEMA_VERSION,
  SENSOR_ASSIGNMENT_VERSION,
  SESSION_SCHEMA_VERSION,
} from '../constants/game';
import type { CommunityCounts, RoundResolution } from './round';
import { parseCommunityCounts, parseRoundResolution } from './round';
import type { Direction, FeatureFlags, Sensor } from '../types/game';
import { parseFeatureFlags } from './bootstrap';

export type EchoSignal = {
  direction: Direction;
  continuity: 'open' | 'narrow' | 'blocked';
  cavity: 'solid' | 'hollow' | 'deep';
  stability: 'stable' | 'fragile' | 'collapsing';
  depth: 'near' | 'middle' | 'far';
};

export type HeatSignal = {
  direction: Direction;
  temperature: 'cold' | 'neutral' | 'warm' | 'burning';
  presence: 'none' | 'dormant' | 'moving' | 'swarm';
  motion: 'still' | 'drifting' | 'approaching';
  volatility: 'stable' | 'rising' | 'pulsing';
};

export type WindSignal = {
  direction: Direction;
  strength: 'still' | 'weak' | 'steady' | 'violent';
  flow: 'inward' | 'outward' | 'crosscurrent';
  contamination: 'clear' | 'spores' | 'ash' | 'toxic';
  turbulence: 'smooth' | 'eddying' | 'chaotic';
};

type PerceptionBase = {
  schemaVersion: number;
  activationDescriptions: [string, string, string];
};

export type EchoPerception = PerceptionBase & {
  sensor: 'echo';
  structuralSignals: EchoSignal[];
};

export type HeatPerception = PerceptionBase & {
  sensor: 'heat';
  thermalSignals: HeatSignal[];
};

export type WindPerception = PerceptionBase & {
  sensor: 'wind';
  airflowSignals: WindSignal[];
};

export type PlayerPerception = EchoPerception | HeatPerception | WindPerception;

export type PlayerSession = {
  schemaVersion: number;
  expedition: {
    chapter: number;
    day: number;
    title: string;
    status: 'open' | 'resolved';
  };
  player: {
    authentication: 'authenticated' | 'guest';
    sensor: Sensor;
    stableAssignment: boolean;
    assignmentVersion: number;
  };
  perception: PlayerPerception;
  round: {
    canVote: boolean;
    canResolve: boolean;
    currentVote: Direction | null;
    revision: number;
    counts: CommunityCounts;
    aggregateVisible: boolean;
    resolution: RoundResolution | null;
  };
  featureFlags: FeatureFlags;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAllowed = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.includes(value as T);

const parseDescriptions = (value: unknown): [string, string, string] | null =>
  Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'string')
    ? [value[0] as string, value[1] as string, value[2] as string]
    : null;

const parseSignals = <T>(
  value: unknown,
  parse: (item: unknown) => T | null
): T[] | null => {
  if (!Array.isArray(value) || value.length !== AVAILABLE_DIRECTIONS.length) return null;
  const parsed = value.map(parse);
  return parsed.every((item): item is T => item !== null) ? parsed : null;
};

const parseEchoSignal = (value: unknown): EchoSignal | null => {
  if (!isRecord(value)) return null;
  if (
    !isAllowed(value.direction, AVAILABLE_DIRECTIONS) ||
    !isAllowed(value.continuity, ['open', 'narrow', 'blocked'] as const) ||
    !isAllowed(value.cavity, ['solid', 'hollow', 'deep'] as const) ||
    !isAllowed(value.stability, ['stable', 'fragile', 'collapsing'] as const) ||
    !isAllowed(value.depth, ['near', 'middle', 'far'] as const)
  ) return null;
  return {
    direction: value.direction,
    continuity: value.continuity,
    cavity: value.cavity,
    stability: value.stability,
    depth: value.depth,
  };
};

const parseHeatSignal = (value: unknown): HeatSignal | null => {
  if (!isRecord(value)) return null;
  if (
    !isAllowed(value.direction, AVAILABLE_DIRECTIONS) ||
    !isAllowed(value.temperature, ['cold', 'neutral', 'warm', 'burning'] as const) ||
    !isAllowed(value.presence, ['none', 'dormant', 'moving', 'swarm'] as const) ||
    !isAllowed(value.motion, ['still', 'drifting', 'approaching'] as const) ||
    !isAllowed(value.volatility, ['stable', 'rising', 'pulsing'] as const)
  ) return null;
  return {
    direction: value.direction,
    temperature: value.temperature,
    presence: value.presence,
    motion: value.motion,
    volatility: value.volatility,
  };
};

const parseWindSignal = (value: unknown): WindSignal | null => {
  if (!isRecord(value)) return null;
  if (
    !isAllowed(value.direction, AVAILABLE_DIRECTIONS) ||
    !isAllowed(value.strength, ['still', 'weak', 'steady', 'violent'] as const) ||
    !isAllowed(value.flow, ['inward', 'outward', 'crosscurrent'] as const) ||
    !isAllowed(value.contamination, ['clear', 'spores', 'ash', 'toxic'] as const) ||
    !isAllowed(value.turbulence, ['smooth', 'eddying', 'chaotic'] as const)
  ) return null;
  return {
    direction: value.direction,
    strength: value.strength,
    flow: value.flow,
    contamination: value.contamination,
    turbulence: value.turbulence,
  };
};

export const parsePlayerPerception = (value: unknown): PlayerPerception | null => {
  if (!isRecord(value) || value.schemaVersion !== PERCEPTION_SCHEMA_VERSION) return null;
  const descriptions = parseDescriptions(value.activationDescriptions);
  if (descriptions === null || !isAllowed(value.sensor, AVAILABLE_SENSORS)) return null;
  if (value.sensor === 'echo') {
    const signals = parseSignals(value.structuralSignals, parseEchoSignal);
    return signals ? { sensor: 'echo', schemaVersion: value.schemaVersion, structuralSignals: signals, activationDescriptions: descriptions } : null;
  }
  if (value.sensor === 'heat') {
    const signals = parseSignals(value.thermalSignals, parseHeatSignal);
    return signals ? { sensor: 'heat', schemaVersion: value.schemaVersion, thermalSignals: signals, activationDescriptions: descriptions } : null;
  }
  const signals = parseSignals(value.airflowSignals, parseWindSignal);
  return signals ? { sensor: 'wind', schemaVersion: value.schemaVersion, airflowSignals: signals, activationDescriptions: descriptions } : null;
};

export const parsePlayerSession = (value: unknown): PlayerSession | null => {
  if (!isRecord(value) || !isRecord(value.expedition) || !isRecord(value.player) || !isRecord(value.round)) return null;
  const perception = parsePlayerPerception(value.perception);
  const counts = parseCommunityCounts(value.round.counts);
  const resolution = value.round.resolution === null ? null : parseRoundResolution(value.round.resolution);
  const flags = parseFeatureFlags(value.featureFlags);
  if (
    value.schemaVersion !== SESSION_SCHEMA_VERSION ||
    typeof value.expedition.chapter !== 'number' || !Number.isSafeInteger(value.expedition.chapter) || value.expedition.chapter < 1 ||
    typeof value.expedition.day !== 'number' || !Number.isSafeInteger(value.expedition.day) || value.expedition.day < 1 ||
    typeof value.expedition.title !== 'string' ||
    (value.expedition.status !== 'open' && value.expedition.status !== 'resolved') ||
    (value.player.authentication !== 'authenticated' && value.player.authentication !== 'guest') ||
    !isAllowed(value.player.sensor, AVAILABLE_SENSORS) ||
    typeof value.player.stableAssignment !== 'boolean' ||
    value.player.assignmentVersion !== SENSOR_ASSIGNMENT_VERSION ||
    perception === null || perception.sensor !== value.player.sensor ||
    typeof value.round.canVote !== 'boolean' || typeof value.round.canResolve !== 'boolean' ||
    (value.round.currentVote !== null && !isAllowed(value.round.currentVote, AVAILABLE_DIRECTIONS)) ||
    typeof value.round.revision !== 'number' || !Number.isSafeInteger(value.round.revision) || value.round.revision < 0 ||
    counts === null || typeof value.round.aggregateVisible !== 'boolean' ||
    (value.player.authentication === 'guest' && (value.player.stableAssignment || value.round.canVote)) ||
    (value.player.authentication === 'authenticated' && !value.player.stableAssignment) ||
    (value.expedition.status === 'resolved') !== (resolution !== null) || flags === null
  ) return null;
  return {
    schemaVersion: value.schemaVersion,
    expedition: {
      chapter: value.expedition.chapter,
      day: value.expedition.day,
      title: value.expedition.title,
      status: value.expedition.status,
    },
    player: {
      authentication: value.player.authentication,
      sensor: value.player.sensor,
      stableAssignment: value.player.stableAssignment,
      assignmentVersion: value.player.assignmentVersion,
    },
    perception,
    round: {
      canVote: value.round.canVote,
      canResolve: value.round.canResolve,
      currentVote: value.round.currentVote,
      revision: value.round.revision,
      counts,
      aggregateVisible: value.round.aggregateVisible,
      resolution,
    },
    featureFlags: flags,
  };
};
