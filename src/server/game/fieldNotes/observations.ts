import type { SensorObservationOption } from '../../../shared/contracts/fieldNotes';
import type { Sensor } from '../../../shared/types/game';

/**
 * Server-only observation vocabulary. Each entry is a neutral interpretation a
 * player may claim to have sensed — never a result, survivability or the optimal
 * route. `label` is safe to send to the composer; `clause` is only ever used to
 * build the public comment body server-side and is never serialized on its own.
 */
export type SensorObservation = SensorObservationOption & {
  clause: string;
};

const OBSERVATIONS: Record<Sensor, readonly SensorObservation[]> = {
  echo: [
    { id: 'open-continuity', label: 'Open, continuous stone', clause: 'Continuous stone opening ahead' },
    { id: 'deep-hollow', label: 'A deep hollow', clause: 'A deep hollow answering back' },
    { id: 'fragile-wall', label: 'A fragile, fractured wall', clause: 'A fragile wall returning a broken echo' },
    { id: 'blocked-return', label: 'A blocked, solid return', clause: 'A blocked return with no way through' },
  ],
  heat: [
    { id: 'moving-warmth', label: 'Moving warmth', clause: 'Moving warmth beyond the passage' },
    { id: 'dormant-presence', label: 'A dormant presence', clause: 'A dormant presence resting in the dark' },
    { id: 'rising-heat', label: 'Rising, volatile heat', clause: 'Rising heat that will not settle' },
    { id: 'cold-silence', label: 'Cold silence', clause: 'Cold silence with nothing alive' },
  ],
  wind: [
    { id: 'clean-outflow', label: 'A clean outward current', clause: 'A clean current flowing outward' },
    { id: 'spore-current', label: 'A spore-carrying current', clause: 'A current carrying spores' },
    { id: 'crosscurrent', label: 'A confusing crosscurrent', clause: 'A crosscurrent pulling two ways' },
    { id: 'still-air', label: 'Still, unmoving air', clause: 'Still air that gives nothing away' },
  ],
};

export const getObservationsForSensor = (sensor: Sensor): SensorObservationOption[] =>
  OBSERVATIONS[sensor].map(({ id, label }) => ({ id, label }));

/** Returns the observation only when it belongs to the caller's assigned sensor; null rejects cross-sensor ids. */
export const findObservationForSensor = (
  sensor: Sensor,
  observationId: string
): SensorObservation | null =>
  OBSERVATIONS[sensor].find((observation) => observation.id === observationId) ?? null;

export const allObservationIds = (): string[] =>
  (Object.keys(OBSERVATIONS) as Sensor[]).flatMap((sensor) =>
    OBSERVATIONS[sensor].map((observation) => observation.id)
  );
