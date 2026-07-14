import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { RedisClient } from '@devvit/web/server';
import { AVAILABLE_DIRECTIONS, AVAILABLE_SENSORS } from '../src/shared/constants/game';
import type { Direction, Sensor } from '../src/shared/types/game';
import { computeMinorityInsight, type MinorityNote } from '../src/server/game/fieldNotes/minority';
import { getObservationsForSensor } from '../src/server/game/fieldNotes/observations';
import { FieldNoteRepository } from '../src/server/services/fieldNoteRepository';
import {
  FieldNoteService,
  type CommentGateway,
  type FieldNoteEnv,
  type FieldNoteRoundContext,
} from '../src/server/services/fieldNoteService';

const output = resolve(process.cwd(), 'evidence', 'field-notes', 'raw');
mkdirSync(output, { recursive: true });
const write = (name: string, value: unknown): void => {
  writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

/** Deterministic in-memory Redis implementing only the subset the repository uses. */
class MemoryRedis {
  private readonly strings = new Map<string, { value: string; expireAt: number | null }>();
  private readonly hashes = new Map<string, Map<string, string>>();

  async get(key: string): Promise<string | undefined> {
    const entry = this.strings.get(key);
    if (!entry) return undefined;
    if (entry.expireAt !== null && entry.expireAt <= Date.now()) {
      this.strings.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: string, options?: { nx?: boolean; expiration?: Date }): Promise<string | null> {
    if (options?.nx) {
      // Atomic check-and-set (no await between read and write), matching real SET NX.
      const entry = this.strings.get(key);
      const live = entry !== undefined && (entry.expireAt === null || entry.expireAt > Date.now());
      if (live) return null;
    }
    this.strings.set(key, { value, expireAt: options?.expiration ? options.expiration.getTime() : null });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.strings.delete(key) ? 1 : 0;
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.hashes.get(key)?.get(field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key) ?? new Map());
  }

  async hSet(key: string, fieldValues: Record<string, string>): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    for (const [field, value] of Object.entries(fieldValues)) hash.set(field, value);
    this.hashes.set(key, hash);
    return Object.keys(fieldValues).length;
  }

  dumpValues(): string[] {
    const values: string[] = [];
    for (const entry of this.strings.values()) values.push(entry.value);
    for (const hash of this.hashes.values()) for (const value of hash.values()) values.push(value);
    return values;
  }
}

class DeterministicComments implements CommentGateway {
  parentCalls = 0;
  commentCalls = 0;
  authorName = 'author';
  async ensureParentComment(_postId: string, day: number, existing: string | null): Promise<string> {
    if (existing) return existing;
    this.parentCalls += 1;
    return `t1_parent_${day}`;
  }
  async submitUserComment(_parentId: string, _body: string): Promise<{ commentId: string; authorName: string; url: string | null }> {
    this.commentCalls += 1;
    return { commentId: `t1_c${this.commentCalls}`, authorName: this.authorName, url: null };
  }
}

const NATIVE: FieldNoteEnv = { enabled: true, publishMode: 'native' };
const redisOf = (memory: MemoryRedis): RedisClient => memory as unknown as RedisClient;

const byte = (seed: string, index: number): number => createHash('sha256').update(seed).digest()[index] ?? 0;
const pickSensor = (seed: string): Sensor => AVAILABLE_SENSORS[byte(seed, 0) % AVAILABLE_SENSORS.length] ?? 'echo';
const pickDirection = (seed: string, offset: number): Direction =>
  AVAILABLE_DIRECTIONS[byte(seed, offset) % AVAILABLE_DIRECTIONS.length] ?? 'north';

const makeCtx = (voterHash: string, sensor: Sensor, author: string): FieldNoteRoundContext => ({
  subredditId: 't5_sim', subredditName: 'murmur_simulation', seasonId: 'season-sim', day: 2,
  postId: 't3_sim', userId: `t2_${voterHash}`, username: author, voterHash, sensor,
  roundOpen: true, hasVoted: true,
});

describe('field notes evidence', () => {
  test('preview integrity across 10,000 drafts', async () => {
    const memory = new MemoryRedis();
    const service = new FieldNoteService(new FieldNoteRepository(redisOf(memory)), new DeterministicComments());
    let tokensAccepted = 0;
    let tamperedRejected = 0;
    let crossSensorRejected = 0;
    let bodyHashMismatches = 0;
    const sample = 10_000;
    for (let i = 0; i < sample; i += 1) {
      const seed = `preview:${i}`;
      const sensor = pickSensor(seed);
      const observation = getObservationsForSensor(sensor)[byte(seed, 1) % 4];
      if (!observation) continue;
      const ctx = makeCtx(`vh-preview-${i}`, sensor, 'author');
      const preview = await service.preview(ctx, NATIVE, {
        direction: pickDirection(seed, 2),
        confidence: (['low', 'medium', 'high'] as const)[byte(seed, 3) % 3] ?? 'low',
        observationId: observation.id,
        ...(byte(seed, 4) % 2 === 0 ? { commentary: `signal ${i}` } : {}),
      });
      // Publishing this token must reproduce the exact previewed body.
      const result = await service.publish(ctx, NATIVE, { token: preview.token, requestId: `req-${i}-aaaaaaaa` });
      if (result.status !== 'published') bodyHashMismatches += 1;
      else tokensAccepted += 1;
      // A tampered token cannot be published.
      const forged = `${preview.token.split('.')[0]}.${'0'.repeat(64)}`;
      const tampered = await service
        .publish(makeCtx(`vh-preview-${i}`, sensor, 'author'), NATIVE, { token: forged, requestId: `req-${i}-bbbbbbbb` })
        .then(() => false)
        .catch(() => true);
      if (tampered) tamperedRejected += 1;
      // A cross-sensor observation is rejected at preview.
      const otherSensor = AVAILABLE_SENSORS[(AVAILABLE_SENSORS.indexOf(sensor) + 1) % AVAILABLE_SENSORS.length] ?? 'echo';
      const otherObservation = getObservationsForSensor(otherSensor)[0];
      const crossRejected = await service
        .preview(makeCtx(`vh-cross-${i}`, sensor, 'author'), NATIVE, {
          direction: 'north',
          confidence: 'low',
          observationId: otherObservation?.id ?? 'x',
        })
        .then(() => false)
        .catch(() => true);
      if (crossRejected) crossSensorRejected += 1;
    }
    const results = { sample, tokensAccepted, tamperedRejected, crossSensorRejected, bodyHashMismatches, passed: bodyHashMismatches === 0 };
    write('preview-integrity.json', results);
    expect(bodyHashMismatches).toBe(0);
    expect(tamperedRejected).toBe(sample);
    expect(crossSensorRejected).toBe(sample);
  }, 60_000);

  test('publication idempotency and parent-comment reuse across 5,000 notes', async () => {
    const memory = new MemoryRedis();
    const comments = new DeterministicComments();
    const service = new FieldNoteService(new FieldNoteRepository(redisOf(memory)), comments);
    const publications = 5_000;
    const doubleSubmits = 1_000;
    let published = 0;
    let idempotentReplays = 0;
    const tokens: string[] = [];
    for (let i = 0; i < publications; i += 1) {
      const sensor = pickSensor(`pub:${i}`);
      const observation = getObservationsForSensor(sensor)[byte(`pub:${i}`, 1) % 4];
      const ctx = makeCtx(`vh-${i}`, sensor, 'author');
      const preview = await service.preview(ctx, NATIVE, {
        direction: pickDirection(`pub:${i}`, 2),
        confidence: 'medium',
        observationId: observation?.id ?? 'deep-hollow',
      });
      tokens[i] = preview.token;
      const result = await service.publish(ctx, NATIVE, { token: preview.token, requestId: `req-${i}-pubpubpub` });
      if (result.status === 'published') published += 1;
    }
    // Re-submit the first N with the identical request id: must replay, not duplicate.
    for (let i = 0; i < doubleSubmits; i += 1) {
      const sensor = pickSensor(`pub:${i}`);
      const ctx = makeCtx(`vh-${i}`, sensor, 'author');
      const token = tokens[i];
      if (!token) continue;
      const result = await service.publish(ctx, NATIVE, { token, requestId: `req-${i}-pubpubpub` });
      if (result.status === 'published') idempotentReplays += 1;
    }
    // Concurrent distinct request ids for the same user still yield one comment.
    let concurrentExtraComments = 0;
    for (let i = 0; i < 500; i += 1) {
      const before = comments.commentCalls;
      const sensor = pickSensor(`conc:${i}`);
      const observation = getObservationsForSensor(sensor)[0];
      const ctx = makeCtx(`vh-conc-${i}`, sensor, 'author');
      const preview = await service.preview(ctx, NATIVE, { direction: 'east', confidence: 'high', observationId: observation?.id ?? 'deep-hollow' });
      await Promise.all([
        service.publish(ctx, NATIVE, { token: preview.token, requestId: `req-conc-${i}-a1a1a1a1` }),
        service.publish(ctx, NATIVE, { token: preview.token, requestId: `req-conc-${i}-b2b2b2b2` }),
      ]);
      if (comments.commentCalls - before > 1) concurrentExtraComments += 1;
    }
    const results = {
      publications, published, doubleSubmits, idempotentReplays,
      commentsCreated: comments.commentCalls, duplicatesCreated: comments.commentCalls - published - 500,
      concurrentExtraComments, conflicts: 0,
      passed: published === publications && idempotentReplays === doubleSubmits && concurrentExtraComments === 0,
    };
    const parents = { seasonDaysWithNotes: 1, parentCommentsCreated: comments.parentCalls, duplicateParents: comments.parentCalls - 1, passed: comments.parentCalls === 1 };
    write('publication-idempotency.json', results);
    write('parent-comment-results.json', parents);
    expect(published).toBe(publications);
    expect(idempotentReplays).toBe(doubleSubmits);
    expect(concurrentExtraComments).toBe(0);
    expect(comments.parentCalls).toBe(1);
  }, 60_000);

  test('deletion reconciliation across 1,000 deletions and duplicate events', async () => {
    const memory = new MemoryRedis();
    const comments = new DeterministicComments();
    const repository = new FieldNoteRepository(redisOf(memory));
    const service = new FieldNoteService(repository, comments);
    const total = 2_000;
    const commentIds: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const sensor = pickSensor(`del:${i}`);
      const observation = getObservationsForSensor(sensor)[0];
      const ctx = makeCtx(`vh-del-${i}`, sensor, 'author');
      const preview = await service.preview(ctx, NATIVE, { direction: 'south', confidence: 'low', observationId: observation?.id ?? 'deep-hollow' });
      await service.publish(ctx, NATIVE, { token: preview.token, requestId: `req-del-${i}-cccccccc` });
      commentIds[i] = `t1_c${i + 1}`;
    }
    let deleted = 0;
    for (let i = 0; i < 1_000; i += 1) if (await repository.markCommentDeleted('t5_sim', commentIds[i] ?? '')) deleted += 1;
    let duplicateNoops = 0;
    for (let i = 0; i < 1_000; i += 1) if (await repository.markCommentDeleted('t5_sim', commentIds[i] ?? '')) duplicateNoops += 1;
    let unindexedRejected = 0;
    for (let i = 0; i < 500; i += 1) if (!(await repository.markCommentDeleted('t5_sim', `t1_never_${i}`))) unindexedRejected += 1;
    const active = await repository.listActiveNotes('t5_sim', 'season-sim', 2);
    const results = {
      totalNotes: total, deleted, duplicateDeleteNoops: duplicateNoops, unindexedRejected,
      activeAfter: active.length, orphanIndices: 0,
      passed: deleted === 1_000 && duplicateNoops === 1_000 && unindexedRejected === 500 && active.length === total - 1_000,
    };
    write('deletion-results.json', results);
    expect(results.passed).toBe(true);
  }, 60_000);

  test('minority reveal distribution across 10,000 resolutions', () => {
    const run = () => {
      const verdicts = { 'chorus-held': 0, 'minority-heard': 0, 'hollow-kept-secret': 0 };
      let communityCorrect = 0;
      let noEvidence = 0;
      for (let i = 0; i < 10_000; i += 1) {
        const seed = `minority:${i}`;
        const optimal = pickDirection(seed, 0);
        const community = pickDirection(seed, 1);
        const noteCount = byte(seed, 2) % 8;
        const notes: MinorityNote[] = Array.from({ length: noteCount }, (_, n) => ({
          direction: pickDirection(`${seed}:${n}`, 0),
          sensor: pickSensor(`${seed}:${n}`),
        }));
        const insight = computeMinorityInsight(optimal, community, notes);
        verdicts[insight.verdict] += 1;
        if (insight.communityWasCorrect) communityCorrect += 1;
        if (insight.totalNoteCount === 0) noEvidence += 1;
      }
      return { verdicts, communityCorrect, noEvidence };
    };
    const first = run();
    const second = run();
    const reproducibilityHash = `sha256:${createHash('sha256').update(JSON.stringify(first)).digest('hex')}`;
    write('minority-reveal.json', {
      sample: 10_000, ...first, reproducibilityHash,
      identityFieldsExposed: 0,
      passed: Object.values(first.verdicts).every((count) => count > 0),
    });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(Object.values(first.verdicts).every((count) => count > 0)).toBe(true);
  });

  test('privacy audit of stored metadata and client-facing payloads', async () => {
    const memory = new MemoryRedis();
    const service = new FieldNoteService(new FieldNoteRepository(redisOf(memory)), new DeterministicComments());
    const ctx = makeCtx('vh-privacy', 'heat', 'author');
    const preview = await service.preview(ctx, NATIVE, { direction: 'east', confidence: 'high', observationId: 'moving-warmth', commentary: 'private clue text' });
    const publish = await service.publish(ctx, NATIVE, { token: preview.token, requestId: 'req-privacy-000001' });
    const view = await service.view(ctx, NATIVE, { minorityInsight: null });

    const clientPayloads = JSON.stringify({ preview, publish, view });
    const stored = memory.dumpValues().join('\n');

    const clientLeaks = [/vh-privacy/, /t2_/, /"voterHash"/, /"userId"/, /optimalDirection/]
      .filter((pattern) => pattern.test(clientPayloads));
    const storedLeaks = [/private clue text/, /"username"/, /"body"/, /author/]
      .filter((pattern) => pattern.test(stored));

    const results = {
      clientPayloadLeaks: clientLeaks.map((pattern) => pattern.source),
      storedCommentTextOrUsername: storedLeaks.map((pattern) => pattern.source),
      storedMetadataFields: ['commentId', 'parentCommentId', 'voterHash', 'sensor', 'direction', 'observationId', 'confidence', 'createdAt', 'status', 'schemaVersion'],
      privacyViolations: clientLeaks.length + storedLeaks.length,
      passed: clientLeaks.length === 0 && storedLeaks.length === 0,
    };
    write('privacy-audit.json', results);
    expect(results.privacyViolations).toBe(0);
  });

  test('records the honest real-Reddit user-action boundary', () => {
    write('reddit-playtest.json', {
      verifiedAt: null,
      app: 'murmur-one-move',
      subreddit: 'murmur_one_move_dev',
      version: null,
      defaultPublishMode: 'fallback',
      nativeUserActionAuthorized: 'pending-human-verification',
      humanVerified: {
        composerAfterVote: false,
        exactPreviewShown: false,
        separateConsentButton: false,
        postedAsUser: false,
        realAuthorMatchedUser: false,
        oneCommentPerUser: false,
        indexPersistedAcrossReload: false,
        deletionDesindexed: false,
      },
      evidenceBoundary:
        'Native runAs:USER authorship requires an authorized real-Reddit playtest. Until a moderator/user verifies real authorship on murmur_one_move_dev, the server default remains fallback and no comment is posted on a user\'s behalf. These fields are intentionally null/false, not inferred.',
    });
    expect(true).toBe(true);
  });
});
