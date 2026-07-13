import { PERCEPTION_SCHEMA_VERSION } from '../../../shared/constants/game';
import type { HeatPerception } from '../../../shared/contracts/session';
import type { WorldTruth } from '../world/worldTypes';

export const projectHeat = (truth: WorldTruth): HeatPerception => {
  const signals = truth.paths.map(({ direction, thermal }) => ({
    direction,
    temperature: thermal.temperature,
    presence: thermal.signature,
    motion: thermal.motion,
    volatility: thermal.volatility,
  }));
  const warm = signals.find(({ temperature }) => temperature === 'warm');
  const moving = signals.find(({ presence }) => presence === 'moving');
  const volatile = signals.find(({ volatility }) => volatility === 'pulsing');
  return {
    sensor: 'heat',
    schemaVersion: PERCEPTION_SCHEMA_VERSION,
    thermalSignals: signals,
    activationDescriptions: [
      `A localized ${warm?.temperature ?? 'neutral'} gradient gathers near the ${warm?.direction ?? 'dark'}.`,
      `A ${moving?.motion ?? 'still'} living signature shifts beyond the ${moving?.direction ?? 'cavern'}.`,
      `Heat ${volatile?.volatility ?? 'stable'} in the ${volatile?.direction ?? 'distance'} with an uneven rhythm.`,
    ],
  };
};
