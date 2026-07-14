import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FieldNotePublishMode, NoteConfidence } from '../../../shared/contracts/fieldNotes';
import { FIELD_NOTE_SCHEMA_VERSION } from '../../../shared/constants/game';
import { AVAILABLE_DIRECTIONS, AVAILABLE_SENSORS, NOTE_CONFIDENCES } from '../../../shared/constants/game';
import type { Direction, Sensor } from '../../../shared/types/game';

/**
 * The signed contents that bind a preview to its exact publishable body. It
 * round-trips through the client but is authenticated by an installation-scoped
 * HMAC secret, so a tampered or expired token cannot be published.
 */
export type PreviewTokenPayload = {
  v: number;
  voterHash: string;
  seasonId: string;
  day: number;
  postId: string;
  sensor: Sensor;
  direction: Direction;
  confidence: NoteConfidence;
  observationId: string;
  commentary?: string;
  bodyHash: string;
  mode: FieldNotePublishMode;
  iat: number;
  exp: number;
};

const sign = (secret: string, payloadB64: string): string =>
  createHmac('sha256', secret).update(payloadB64).digest('hex');

const isAllowed = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.some((candidate) => candidate === value);

export const createPreviewToken = (secret: string, payload: PreviewTokenPayload): string => {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadB64}.${sign(secret, payloadB64)}`;
};

const parsePayload = (value: unknown): PreviewTokenPayload | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.v !== FIELD_NOTE_SCHEMA_VERSION ||
    typeof record.voterHash !== 'string' ||
    typeof record.seasonId !== 'string' ||
    typeof record.day !== 'number' ||
    !Number.isInteger(record.day) ||
    typeof record.postId !== 'string' ||
    !isAllowed(record.sensor, AVAILABLE_SENSORS) ||
    !isAllowed(record.direction, AVAILABLE_DIRECTIONS) ||
    !isAllowed(record.confidence, NOTE_CONFIDENCES) ||
    typeof record.observationId !== 'string' ||
    (record.commentary !== undefined && typeof record.commentary !== 'string') ||
    typeof record.bodyHash !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(record.bodyHash) ||
    (record.mode !== 'native' && record.mode !== 'fallback') ||
    typeof record.iat !== 'number' ||
    typeof record.exp !== 'number'
  ) {
    return null;
  }
  const payload: PreviewTokenPayload = {
    v: FIELD_NOTE_SCHEMA_VERSION,
    voterHash: record.voterHash,
    seasonId: record.seasonId,
    day: record.day,
    postId: record.postId,
    sensor: record.sensor,
    direction: record.direction,
    confidence: record.confidence,
    observationId: record.observationId,
    bodyHash: record.bodyHash,
    mode: record.mode,
    iat: record.iat,
    exp: record.exp,
  };
  if (typeof record.commentary === 'string') payload.commentary = record.commentary;
  return payload;
};

/** Returns the payload only when the signature matches and the token has not expired. */
export const verifyPreviewToken = (
  secret: string,
  token: string,
  nowMs: number
): PreviewTokenPayload | null => {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(secret, payloadB64);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const payload = parsePayload(decoded);
  if (!payload || payload.exp <= nowMs) return null;
  return payload;
};
