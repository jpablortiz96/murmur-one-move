import type { Sensor } from '../../../shared/types/game';
import { EchoExperience } from './EchoExperience';
import { HeatExperience } from './HeatExperience';
import type { SensorExperience, SensorExperienceContext } from './SensorExperience';
import { WindExperience } from './WindExperience';

export const createSensorExperience = (sensor: Sensor, context: SensorExperienceContext): SensorExperience => {
  const factories = {
    echo: () => new EchoExperience(context),
    heat: () => new HeatExperience(context),
    wind: () => new WindExperience(context),
  } satisfies Record<Sensor, () => SensorExperience>;
  return factories[sensor]();
};
