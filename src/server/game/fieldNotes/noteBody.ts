import { createHash } from 'node:crypto';
import type { NoteConfidence } from '../../../shared/contracts/fieldNotes';
import type { Direction, Sensor } from '../../../shared/types/game';

const CONFIDENCE_LABEL: Record<NoteConfidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export type FieldNoteBodyInput = {
  sensor: Sensor;
  direction: Direction;
  confidence: NoteConfidence;
  clause: string;
  commentary?: string;
};

/**
 * Builds the exact, scannable comment body shown in the preview and published
 * verbatim. Deterministic: identical input always yields the identical string,
 * which is what the preview token binds to. Never contains hidden World Truth,
 * the optimal route, usernames, links or marketing.
 */
export const buildFieldNoteBody = (input: FieldNoteBodyInput): string => {
  const heading = `**${input.sensor.toUpperCase()} FIELD NOTE · ${input.direction.toUpperCase()}**`;
  const reading = `${input.clause} · ${CONFIDENCE_LABEL[input.confidence]}`;
  const lines = [heading, '', reading];
  if (input.commentary && input.commentary.length > 0) {
    lines.push('', `> ${input.commentary}`);
  }
  return lines.join('\n');
};

export const fieldNoteBodyHash = (body: string): string =>
  `sha256:${createHash('sha256').update(body).digest('hex')}`;
