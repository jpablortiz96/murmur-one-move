export const APP_VERSION = '0.1.0';
export const GAME_TITLE = 'MURMUR';
export const GAME_TAGLINE = 'Everyone sees a different truth.';
export const MAX_ECHO_PULSES = 3;
export const MAX_SENSOR_ACTIVATIONS = 3;
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
  'manualResolutionEnabled',
  'communityPersistenceEnabled',
  'privateSensorsEnabled',
] as const;

export const ROUND_SCHEMA_VERSION = 1;
export const ROUND_RESOLUTION_VERSION = 1;
export const CURRENT_CHAPTER_NUMBER = 1;
export const CURRENT_DAY = 1;
export const SESSION_SCHEMA_VERSION = 2;
export const PERCEPTION_SCHEMA_VERSION = 1;
export const SENSOR_ASSIGNMENT_VERSION = 1;
export const WORLD_GENERATOR_VERSION = 1;

export const NOTE_CONFIDENCES = ['low', 'medium', 'high'] as const;
export const FIELD_NOTE_SCHEMA_VERSION = 1;
export const FIELD_NOTE_MAX_COMMENTARY = 160;
// Aggregate breakdowns and the correct-minority reveal only appear once at least
// this many active notes exist, so no single contributor represents a sense.
export const FIELD_NOTE_BOARD_MIN_NOTES = 3;
export const MINORITY_MIN_NOTES = 3;
// A preview token is a short-lived, server-verifiable authorization to publish
// the exact previewed body; it is not persisted content.
export const FIELD_NOTE_PREVIEW_TTL_MS = 10 * 60 * 1_000;
