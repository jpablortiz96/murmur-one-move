import type { FeatureFlags } from '../../shared/types/game';
import type { FieldNotePublishMode } from '../../shared/contracts/fieldNotes';

export const CURRENT_FEATURE_FLAGS: FeatureFlags = {
  echoEnabled: true,
  heatEnabled: true,
  windEnabled: true,
  dailyResolutionEnabled: true,
  manualResolutionEnabled: true,
  communityPersistenceEnabled: true,
  privateSensorsEnabled: true,
};

/**
 * Server-authoritative Field Notes configuration. `publishMode` defaults to
 * `fallback` (honest copy-to-comments) so the app never posts as a user before
 * real Reddit User Actions authorization is verified on the community. Flip to
 * `native` only after a verified authorship playtest; see docs/FIELD_NOTES_CONTRACT.md.
 */
export type FieldNotesConfig = {
  enabled: boolean;
  publishMode: FieldNotePublishMode;
};

export const FIELD_NOTES_CONFIG: FieldNotesConfig = {
  enabled: true,
  publishMode: 'fallback',
};
