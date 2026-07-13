import { describe, expect, it } from 'vitest';
import { isFeatureEnabled, type FeatureFlags } from '../src/shared/types/game';

const flags: FeatureFlags = {
  echoEnabled: true,
  heatEnabled: false,
  windEnabled: false,
  dailyResolutionEnabled: false,
  manualResolutionEnabled: true,
  communityPersistenceEnabled: true,
  privateSensorsEnabled: false,
};

describe('feature flags', () => {
  it('enables only the implemented Echo sensor', () => {
    expect(isFeatureEnabled(flags, 'echoEnabled')).toBe(true);
    expect(isFeatureEnabled(flags, 'heatEnabled')).toBe(false);
    expect(isFeatureEnabled(flags, 'windEnabled')).toBe(false);
  });

  it('enables manual persistence without claiming automatic daily resolution', () => {
    expect(isFeatureEnabled(flags, 'dailyResolutionEnabled')).toBe(false);
    expect(isFeatureEnabled(flags, 'manualResolutionEnabled')).toBe(true);
    expect(isFeatureEnabled(flags, 'communityPersistenceEnabled')).toBe(true);
    expect(isFeatureEnabled(flags, 'privateSensorsEnabled')).toBe(false);
  });
});
