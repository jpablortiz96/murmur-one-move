import type {
  AVAILABLE_DIRECTIONS,
  AVAILABLE_SENSORS,
  FEATURE_FLAG_KEYS,
} from '../constants/game';

export type Direction = (typeof AVAILABLE_DIRECTIONS)[number];
export type Sensor = (typeof AVAILABLE_SENSORS)[number];
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const normalizeDirection = (value: unknown): Direction | null => {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  const aliases: Readonly<Record<string, Direction>> = {
    n: 'north',
    north: 'north',
    e: 'east',
    east: 'east',
    s: 'south',
    south: 'south',
    w: 'west',
    west: 'west',
  };

  return aliases[normalized] ?? null;
};

export const isFeatureEnabled = (
  flags: FeatureFlags,
  key: FeatureFlagKey
): boolean => flags[key];

