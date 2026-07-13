import { describe, expect, it } from 'vitest';
import { parseBootstrap, parseFeatureFlags } from '../src/shared/contracts/bootstrap';

const validBootstrap = {
  gameTitle: 'MURMUR',
  tagline: 'Everyone sees a different truth.',
  chapter: 'The First Hollow',
  day: 1,
  serverTime: '2026-07-10T17:00:00.000Z',
  availableSensors: ['echo', 'heat', 'wind'],
  availableDirections: ['north', 'east', 'south', 'west'],
  featureFlags: {
    echoEnabled: true,
    heatEnabled: false,
    windEnabled: false,
    dailyResolutionEnabled: false,
    manualResolutionEnabled: true,
    communityPersistenceEnabled: true,
    privateSensorsEnabled: false,
  },
};

describe('bootstrap validation', () => {
  it('accepts the complete typed bootstrap contract', () => {
    const parsed = parseBootstrap(validBootstrap);

    expect(parsed?.gameTitle).toBe('MURMUR');
    expect(parsed?.availableDirections).toEqual(['north', 'east', 'south', 'west']);
  });

  it('rejects invalid server time, directions, and disabled Echo', () => {
    expect(parseBootstrap({ ...validBootstrap, serverTime: 'sometime' })).toBeNull();
    expect(
      parseBootstrap({ ...validBootstrap, availableDirections: ['north', 'down'] })
    ).toBeNull();
    expect(
      parseBootstrap({
        ...validBootstrap,
        featureFlags: { ...validBootstrap.featureFlags, echoEnabled: false },
      })
    ).toBeNull();
  });

  it('rejects malformed feature flags instead of coercing them', () => {
    expect(
      parseFeatureFlags({ ...validBootstrap.featureFlags, heatEnabled: 'no' })
    ).toBeNull();
    expect(parseFeatureFlags({ echoEnabled: true })).toBeNull();
  });
});
