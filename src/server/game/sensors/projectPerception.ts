import type { PlayerPerception } from '../../../shared/contracts/session';
import type { Sensor } from '../../../shared/types/game';
import type { WorldTruth } from '../world/worldTypes';
import { projectEcho } from './projectEcho';
import { projectHeat } from './projectHeat';
import { projectWind } from './projectWind';

export const projectPerception = (sensor: Sensor, truth: WorldTruth): PlayerPerception => {
  const projectors = {
    echo: projectEcho,
    heat: projectHeat,
    wind: projectWind,
  } satisfies Record<Sensor, (source: WorldTruth) => PlayerPerception>;
  return projectors[sensor](truth);
};
