import { PERCEPTION_SCHEMA_VERSION } from '../../../shared/constants/game';
import type { WindPerception } from '../../../shared/contracts/session';
import type { WorldTruth } from '../world/worldTypes';

export const projectWind = (truth: WorldTruth): WindPerception => {
  const signals = truth.paths.map(({ direction, airflow }) => ({
    direction,
    strength: airflow.strength,
    flow: airflow.flow,
    contamination: airflow.contamination,
    turbulence: airflow.turbulence,
  }));
  const outward = signals.find(({ flow }) => flow === 'outward');
  const eddy = signals.find(({ turbulence }) => turbulence === 'eddying');
  const contaminated = signals.find(({ contamination }) => contamination !== 'clear');
  return {
    sensor: 'wind',
    schemaVersion: PERCEPTION_SCHEMA_VERSION,
    airflowSignals: signals,
    activationDescriptions: [
      `${outward?.strength ?? 'Weak'} air flows outward through the ${outward?.direction ?? 'cavern'}.`,
      `Tracers curl through an ${eddy?.turbulence ?? 'smooth'} current near the ${eddy?.direction ?? 'dark'}.`,
      `${contaminated?.contamination ?? 'Fine dust'} rides the ${contaminated?.direction ?? 'distant'} current in distinct shapes.`,
    ],
  };
};
