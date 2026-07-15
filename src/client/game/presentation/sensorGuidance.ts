import { MAX_SENSOR_ACTIVATIONS } from '../../../shared/constants/game';
import type { Sensor } from '../../../shared/types/game';

/**
 * Sensor guidance used to vanish on a fixed 1.8s timer, so a player who had not
 * yet touched the cavern lost the only explanation of their gesture. Guidance is
 * now driven by interaction, never by a clock: the full instruction stays until
 * the first valid activation, then compacts to a progress line, and can always
 * be recalled. No timing is involved, so reduced motion has the same reading time.
 */
export const INTRO_INSTRUCTION: Record<Sensor, string> = {
  echo: 'Tap the cavern to send an echo.',
  heat: 'Press and hold to focus the heat.',
  wind: 'Drag across the cavern to release tracers.',
};

const COMPACT_INSTRUCTION: Record<Sensor, string> = {
  echo: 'Tap again',
  heat: 'Hold to focus',
  wind: 'Drag to trace',
};

const SENSE_OFFERS: Record<Sensor, string> = {
  echo: 'Echo reveals shape: continuity, hollows and fragile stone.',
  heat: 'Heat reveals warmth: temperature, living presence and volatility.',
  wind: 'Wind reveals air: currents, turbulence and what it carries.',
};

export const shouldShowIntro = (activationsUsed: number): boolean => activationsUsed === 0;

/** The single guidance line: full before the first activation, compact after it. */
export const guidanceFor = (
  sensor: Sensor,
  activationsUsed: number,
  maximum: number = MAX_SENSOR_ACTIVATIONS
): string => {
  if (shouldShowIntro(activationsUsed)) return INTRO_INSTRUCTION[sensor];
  if (activationsUsed >= maximum) return `${COMPACT_INSTRUCTION[sensor]} · ${maximum} of ${maximum} · complete`;
  return `${COMPACT_INSTRUCTION[sensor]} · ${activationsUsed} of ${maximum}`;
};

/**
 * Recallable help. States the gesture, how many activations remain and what the
 * sense offers — never another sense and never the route.
 */
export const helpFor = (
  sensor: Sensor,
  activationsUsed: number,
  maximum: number = MAX_SENSOR_ACTIVATIONS
): string => {
  const remaining = Math.max(0, maximum - activationsUsed);
  const remainingLine = remaining === 0
    ? 'No activations remain. Choose what your sense cannot explain.'
    : `${remaining} of ${maximum} activations remain.`;
  return [
    'HOW TO SENSE',
    '',
    INTRO_INSTRUCTION[sensor],
    remainingLine,
    '',
    SENSE_OFFERS[sensor],
    'Your signal is only part of the truth.',
  ].join('\n');
};
