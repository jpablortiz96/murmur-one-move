import { describe, expect, it } from 'vitest';
import { isFeatureEnabled, type FeatureFlags } from '../src/shared/types/game';

const flags: FeatureFlags = {
  echoEnabled: true,
  heatEnabled: false,
  windEnabled: false,
  dailyResolutionEnabled: false,
  communityPersistenceEnabled: false,
  privateSensorsEnabled: false,
};

describe('feature flags', () => {
  it('enables only the implemented Echo sensor', () => {
    expect(isFeatureEnabled(flags, 'echoEnabled')).toBe(true);
    expect(isFeatureEnabled(flags, 'heatEnabled')).toBe(false);
    expect(isFeatureEnabled(flags, 'windEnabled')).toBe(false);
  });

  it('keeps future community systems disabled', () => {
    expect(isFeatureEnabled(flags, 'dailyResolutionEnabled')).toBe(false);
    expect(isFeatureEnabled(flags, 'communityPersistenceEnabled')).toBe(false);
    expect(isFeatureEnabled(flags, 'privateSensorsEnabled')).toBe(false);
  });
});

