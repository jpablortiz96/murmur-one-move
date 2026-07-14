import { randomUUID } from 'node:crypto';
import type { RedisClient } from '@devvit/web/server';
import { FIELD_NOTE_SCHEMA_VERSION } from '../../shared/constants/game';
import { AVAILABLE_DIRECTIONS, AVAILABLE_SENSORS, NOTE_CONFIDENCES } from '../../shared/constants/game';
import type { NoteConfidence } from '../../shared/contracts/fieldNotes';
import type { Direction, Sensor } from '../../shared/types/game';
import { createFieldNoteKeys } from './fieldNoteKeys';

/** Minimal idempotency marker. Deliberately stores no username or comment text. */
export type IdempotentPublication = { commentId: string; commentUrl: string | null };

type FieldNoteRedis = Pick<RedisClient, 'get' | 'set' | 'del' | 'hGet' | 'hGetAll' | 'hSet'>;

/** Minimal server-only metadata. Comment text/body is never stored here. */
export type FieldNoteIndex = {
  commentId: string;
  parentCommentId: string;
  voterHash: string;
  sensor: Sensor;
  direction: Direction;
  observationId: string;
  confidence: NoteConfidence;
  createdAt: string;
  status: 'active' | 'deleted';
  schemaVersion: number;
};

type CommentLocation = { seasonId: string; day: number; voterHash: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAllowed = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.some((candidate) => candidate === value);

export const parseFieldNoteIndex = (raw: string): FieldNoteIndex | null => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (
    typeof value.commentId !== 'string' ||
    typeof value.parentCommentId !== 'string' ||
    typeof value.voterHash !== 'string' ||
    !isAllowed(value.sensor, AVAILABLE_SENSORS) ||
    !isAllowed(value.direction, AVAILABLE_DIRECTIONS) ||
    typeof value.observationId !== 'string' ||
    !isAllowed(value.confidence, NOTE_CONFIDENCES) ||
    typeof value.createdAt !== 'string' ||
    (value.status !== 'active' && value.status !== 'deleted') ||
    value.schemaVersion !== FIELD_NOTE_SCHEMA_VERSION
  ) {
    return null;
  }
  return {
    commentId: value.commentId,
    parentCommentId: value.parentCommentId,
    voterHash: value.voterHash,
    sensor: value.sensor,
    direction: value.direction,
    observationId: value.observationId,
    confidence: value.confidence,
    createdAt: value.createdAt,
    status: value.status,
    schemaVersion: FIELD_NOTE_SCHEMA_VERSION,
  };
};

const parseLocation = (raw: string): CommentLocation | null => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.seasonId !== 'string' || typeof value.voterHash !== 'string' ||
    typeof value.day !== 'number' || !Number.isInteger(value.day)) {
    return null;
  }
  return { seasonId: value.seasonId, day: value.day, voterHash: value.voterHash };
};

export class FieldNoteRepository {
  constructor(private readonly redis: FieldNoteRedis) {}

  /** Installation-scoped HMAC secret for preview tokens; created once, never exposed. */
  async getOrCreateSecret(subredditId: string): Promise<string> {
    const key = createFieldNoteKeys(subredditId, 'secret', 0).secret;
    const existing = await this.redis.get(key);
    if (existing) return existing;
    const candidate = `${randomUUID()}${randomUUID()}`;
    const result = await this.redis.set(key, candidate, { nx: true });
    if (result === 'OK') return candidate;
    const stored = await this.redis.get(key);
    if (!stored) throw new Error('Field Note secret could not be established');
    return stored;
  }

  async getNote(subredditId: string, seasonId: string, day: number, voterHash: string): Promise<FieldNoteIndex | null> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    const raw = await this.redis.hGet(keys.notes, voterHash);
    return raw ? parseFieldNoteIndex(raw) : null;
  }

  async listActiveNotes(subredditId: string, seasonId: string, day: number): Promise<FieldNoteIndex[]> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    const all = await this.redis.hGetAll(keys.notes);
    return Object.values(all)
      .map(parseFieldNoteIndex)
      .filter((note): note is FieldNoteIndex => note !== null && note.status === 'active');
  }

  async getParent(subredditId: string, seasonId: string, day: number): Promise<string | null> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    return (await this.redis.get(keys.parent)) ?? null;
  }

  async setParent(subredditId: string, seasonId: string, day: number, commentId: string): Promise<void> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    await this.redis.set(keys.parent, commentId);
  }

  async getIdempotent(
    subredditId: string,
    seasonId: string,
    day: number,
    voterHash: string,
    requestId: string
  ): Promise<IdempotentPublication | null> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    const raw = await this.redis.get(keys.idempotency(voterHash, requestId));
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).commentId === 'string') {
        const record = value as Record<string, unknown>;
        return { commentId: record.commentId as string, commentUrl: typeof record.commentUrl === 'string' ? record.commentUrl : null };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Persist the note index, reverse comment index and a minimal idempotency
   * marker together. The marker holds no username or comment text.
   */
  async saveNote(
    subredditId: string,
    seasonId: string,
    day: number,
    index: FieldNoteIndex,
    requestId: string,
    publication: IdempotentPublication
  ): Promise<void> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    await this.redis.hSet(keys.notes, { [index.voterHash]: JSON.stringify(index) });
    await this.redis.set(
      keys.commentIndex(index.commentId),
      JSON.stringify({ seasonId, day, voterHash: index.voterHash } satisfies CommentLocation)
    );
    await this.redis.set(keys.idempotency(index.voterHash, requestId), JSON.stringify(publication));
  }

  /**
   * Marks a native note deleted from its comment ID (the only field a delete
   * trigger reliably carries). Idempotent: a duplicate or out-of-order delete,
   * or a delete for an unindexed comment, is a safe no-op.
   */
  async markCommentDeleted(subredditId: string, commentId: string): Promise<boolean> {
    const keys = createFieldNoteKeys(subredditId, 'lookup', 0);
    const locationRaw = await this.redis.get(keys.commentIndex(commentId));
    if (!locationRaw) return false;
    const location = parseLocation(locationRaw);
    if (!location) return false;
    const dayKeys = createFieldNoteKeys(subredditId, location.seasonId, location.day);
    const raw = await this.redis.hGet(dayKeys.notes, location.voterHash);
    if (!raw) return false;
    const note = parseFieldNoteIndex(raw);
    if (!note || note.commentId !== commentId) return false;
    if (note.status === 'deleted') return true;
    await this.redis.hSet(dayKeys.notes, {
      [location.voterHash]: JSON.stringify({ ...note, status: 'deleted' } satisfies FieldNoteIndex),
    });
    return true;
  }

  /** Desindexes every note for a chapter when its post is deleted. */
  async purgeDay(subredditId: string, seasonId: string, day: number): Promise<number> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    const all = await this.redis.hGetAll(keys.notes);
    const entries = Object.entries(all);
    let purged = 0;
    for (const [voterHash, raw] of entries) {
      const note = parseFieldNoteIndex(raw);
      if (note && note.status === 'active') {
        await this.redis.hSet(keys.notes, {
          [voterHash]: JSON.stringify({ ...note, status: 'deleted' } satisfies FieldNoteIndex),
        });
        purged += 1;
      }
    }
    return purged;
  }

  async withPublishLease<T>(
    subredditId: string,
    seasonId: string,
    day: number,
    voterHash: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    return await this.withLease(keys.publishLease(voterHash), operation);
  }

  async withParentLease<T>(
    subredditId: string,
    seasonId: string,
    day: number,
    operation: () => Promise<T>
  ): Promise<T> {
    const keys = createFieldNoteKeys(subredditId, seasonId, day);
    return await this.withLease(keys.parentLease, operation);
  }

  private async withLease<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    let acquired = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await this.redis.set(key, token, { nx: true, expiration: new Date(Date.now() + 15_000) });
      if (result === 'OK') {
        acquired = true;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(4 + attempt, 25)));
    }
    if (!acquired) throw new Error('Field Note operation lease is busy');
    try {
      return await operation();
    } finally {
      if ((await this.redis.get(key)) === token) await this.redis.del(key);
    }
  }
}
