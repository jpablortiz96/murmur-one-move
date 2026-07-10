import {
  AVAILABLE_DIRECTIONS,
  AVAILABLE_SENSORS,
} from '../constants/game';
import type {
  Direction,
  FeatureFlags,
  Sensor,
} from '../types/game';

export type BootstrapResponse = {
  gameTitle: string;
  tagline: string;
  chapter: string;
  day: number;
  serverTime: string;
  availableSensors: Sensor[];
  availableDirections: Direction[];
  featureFlags: FeatureFlags;
};

export type HealthResponse = {
  status: 'ok';
  version: string;
  serverTime: string;
};

export type ApiErrorResponse = {
  status: 'error';
  message: string;
};

const isAllowedString = <T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T => typeof value === 'string' && allowed.some((item) => item === value);

const parseStringArray = <T extends string>(
  value: unknown,
  allowed: readonly T[]
): T[] | null => {
  if (!Array.isArray(value) || !value.every((item) => isAllowedString(item, allowed))) {
    return null;
  }
  return value;
};

export const parseFeatureFlags = (value: unknown): FeatureFlags | null => {
  if (typeof value !== 'object' || value === null) return null;
  if (
    !('echoEnabled' in value) ||
    !('heatEnabled' in value) ||
    !('windEnabled' in value) ||
    !('dailyResolutionEnabled' in value) ||
    !('communityPersistenceEnabled' in value) ||
    !('privateSensorsEnabled' in value) ||
    typeof value.echoEnabled !== 'boolean' ||
    typeof value.heatEnabled !== 'boolean' ||
    typeof value.windEnabled !== 'boolean' ||
    typeof value.dailyResolutionEnabled !== 'boolean' ||
    typeof value.communityPersistenceEnabled !== 'boolean' ||
    typeof value.privateSensorsEnabled !== 'boolean'
  ) {
    return null;
  }

  return {
    echoEnabled: value.echoEnabled,
    heatEnabled: value.heatEnabled,
    windEnabled: value.windEnabled,
    dailyResolutionEnabled: value.dailyResolutionEnabled,
    communityPersistenceEnabled: value.communityPersistenceEnabled,
    privateSensorsEnabled: value.privateSensorsEnabled,
  };
};

export const parseBootstrap = (value: unknown): BootstrapResponse | null => {
  if (typeof value !== 'object' || value === null) return null;
  if (
    !('gameTitle' in value) ||
    !('tagline' in value) ||
    !('chapter' in value) ||
    !('day' in value) ||
    !('serverTime' in value) ||
    !('availableSensors' in value) ||
    !('availableDirections' in value) ||
    !('featureFlags' in value)
  ) {
    return null;
  }

  const availableSensors = parseStringArray(value.availableSensors, AVAILABLE_SENSORS);
  const availableDirections = parseStringArray(
    value.availableDirections,
    AVAILABLE_DIRECTIONS
  );
  const featureFlags = parseFeatureFlags(value.featureFlags);

  if (
    typeof value.gameTitle !== 'string' ||
    typeof value.tagline !== 'string' ||
    typeof value.chapter !== 'string' ||
    typeof value.day !== 'number' ||
    !Number.isInteger(value.day) ||
    value.day < 1 ||
    typeof value.serverTime !== 'string' ||
    Number.isNaN(Date.parse(value.serverTime)) ||
    availableSensors === null ||
    availableSensors.length === 0 ||
    availableDirections === null ||
    availableDirections.length !== AVAILABLE_DIRECTIONS.length ||
    featureFlags === null ||
    !featureFlags.echoEnabled
  ) {
    return null;
  }

  return {
    gameTitle: value.gameTitle,
    tagline: value.tagline,
    chapter: value.chapter,
    day: value.day,
    serverTime: value.serverTime,
    availableSensors,
    availableDirections,
    featureFlags,
  };
};
