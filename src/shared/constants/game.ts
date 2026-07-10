export const APP_VERSION = '0.1.0';
export const GAME_TITLE = 'MURMUR';
export const GAME_TAGLINE = 'Everyone sees a different truth.';
export const MAX_ECHO_PULSES = 3;
export const DEBUG_DEFAULT = false;

export const AVAILABLE_DIRECTIONS = [
  'north',
  'east',
  'south',
  'west',
] as const;

export const AVAILABLE_SENSORS = ['echo', 'heat', 'wind'] as const;

export const FEATURE_FLAG_KEYS = [
  'echoEnabled',
  'heatEnabled',
  'windEnabled',
  'dailyResolutionEnabled',
  'communityPersistenceEnabled',
  'privateSensorsEnabled',
] as const;

