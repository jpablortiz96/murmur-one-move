import { FIELD_NOTE_BOARD_MIN_NOTES, FIELD_NOTE_PREVIEW_TTL_MS, FIELD_NOTE_SCHEMA_VERSION } from '../../shared/constants/game';
import { AVAILABLE_DIRECTIONS, AVAILABLE_SENSORS } from '../../shared/constants/game';
import { validateCommentary } from '../../shared/contracts/fieldNotes';
import type {
  FieldNoteBoard,
  FieldNoteDraft,
  FieldNotePreview,
  FieldNotePublishMode,
  FieldNotesView,
  MinorityInsight,
  PublishFieldNoteRequest,
  PublishFieldNoteResponse,
} from '../../shared/contracts/fieldNotes';
import type { Direction, Sensor } from '../../shared/types/game';
import { buildFieldNoteBody, fieldNoteBodyHash } from '../game/fieldNotes/noteBody';
import { findObservationForSensor, getObservationsForSensor } from '../game/fieldNotes/observations';
import { createPreviewToken, verifyPreviewToken, type PreviewTokenPayload } from '../game/fieldNotes/previewToken';
import type { FieldNoteIndex, IdempotentPublication } from './fieldNoteRepository';
import { FieldNoteRepository } from './fieldNoteRepository';

export type FieldNoteErrorCode =
  | 'vote-required'
  | 'round-closed'
  | 'cross-sensor'
  | 'invalid-observation'
  | 'invalid-commentary'
  | 'invalid-token'
  | 'already-active'
  | 'field-notes-disabled'
  | 'unavailable';

export class FieldNoteError extends Error {
  readonly code: FieldNoteErrorCode;
  constructor(code: FieldNoteErrorCode, message: string) {
    super(message);
    this.name = 'FieldNoteError';
    this.code = code;
  }
}

export type FieldNoteEnv = {
  enabled: boolean;
  publishMode: FieldNotePublishMode;
};

export type FieldNoteRoundContext = {
  subredditId: string;
  subredditName: string;
  seasonId: string;
  day: number;
  postId: string;
  userId: string;
  username: string | null;
  voterHash: string;
  sensor: Sensor;
  roundOpen: boolean;
  hasVoted: boolean;
};

export type CommentGateway = {
  /** Creates (as the APP account) or returns the existing chapter Field Notes parent comment. */
  ensureParentComment(postId: string, day: number, existing: string | null): Promise<string>;
  /** Submits a reply as the requesting USER; returns the real author reported by Reddit. */
  submitUserComment(parentId: string, body: string): Promise<{ commentId: string; authorName: string; url: string | null }>;
};

/**
 * Canonical comments URL for the chapter post being read. Reddit addresses a post
 * by its base36 id, so the stored `t3_` thing prefix is stripped. The caller's
 * post always comes from server context, never from client input.
 */
export const commentsUrlFor = (postId: string): string =>
  `https://www.reddit.com/comments/${postId.replace(/^t3_/, '')}`;

const commentPermalink = (postId: string, commentId: string): string =>
  `https://www.reddit.com/comments/${postId.replace(/^t3_/, '')}/comment/${commentId.replace(/^t1_/, '')}/`;

export const buildFieldNoteBoard = (notes: readonly FieldNoteIndex[]): FieldNoteBoard => {
  const totalNotes = notes.length;
  const thresholdMet = totalNotes >= FIELD_NOTE_BOARD_MIN_NOTES;
  if (!thresholdMet) {
    return { totalNotes, thresholdMet: false, bySensor: null, byDirection: null };
  }
  const bySensor = Object.fromEntries(AVAILABLE_SENSORS.map((sensor) => [sensor, 0])) as Record<Sensor, number>;
  const byDirection = Object.fromEntries(AVAILABLE_DIRECTIONS.map((direction) => [direction, 0])) as Record<Direction, number>;
  for (const note of notes) {
    bySensor[note.sensor] += 1;
    byDirection[note.direction] += 1;
  }
  return { totalNotes, thresholdMet: true, bySensor, byDirection };
};

export class FieldNoteService {
  constructor(
    private readonly repository: FieldNoteRepository,
    private readonly comments: CommentGateway,
    private readonly now: () => Date = () => new Date()
  ) {}

  async preview(ctx: FieldNoteRoundContext, env: FieldNoteEnv, draft: FieldNoteDraft): Promise<FieldNotePreview> {
    this.assertContributable(ctx, env);
    const existing = await this.repository.getNote(ctx.subredditId, ctx.seasonId, ctx.day, ctx.voterHash);
    if (existing && existing.status === 'active') {
      throw new FieldNoteError('already-active', 'You already shared a Field Note this chapter');
    }
    const observation = findObservationForSensor(ctx.sensor, draft.observationId);
    if (!observation) {
      throw new FieldNoteError('cross-sensor', 'That observation does not belong to your sense');
    }
    const commentary = validateCommentary(draft.commentary);
    if (!commentary.ok) throw new FieldNoteError('invalid-commentary', commentary.reason);

    const body = buildFieldNoteBody({
      sensor: ctx.sensor,
      direction: draft.direction,
      confidence: draft.confidence,
      clause: observation.clause,
      ...(commentary.value !== undefined ? { commentary: commentary.value } : {}),
    });
    const bodyHash = fieldNoteBodyHash(body);
    const nowMs = this.now().getTime();
    const secret = await this.repository.getOrCreateSecret(ctx.subredditId);
    const payload: PreviewTokenPayload = {
      v: FIELD_NOTE_SCHEMA_VERSION,
      voterHash: ctx.voterHash,
      seasonId: ctx.seasonId,
      day: ctx.day,
      postId: ctx.postId,
      sensor: ctx.sensor,
      direction: draft.direction,
      confidence: draft.confidence,
      observationId: observation.id,
      bodyHash,
      mode: env.publishMode,
      iat: nowMs,
      exp: nowMs + FIELD_NOTE_PREVIEW_TTL_MS,
      ...(commentary.value !== undefined ? { commentary: commentary.value } : {}),
    };
    const parentId = await this.repository.getParent(ctx.subredditId, ctx.seasonId, ctx.day);
    return {
      schemaVersion: FIELD_NOTE_SCHEMA_VERSION,
      body,
      destination: { postId: ctx.postId, commentsUrl: commentsUrlFor(ctx.postId), parentKnown: parentId !== null },
      publishMode: env.publishMode,
      authorName: env.publishMode === 'native' ? ctx.username : null,
      token: createPreviewToken(secret, payload),
      expiresAt: new Date(payload.exp).toISOString(),
    };
  }

  async publish(
    ctx: FieldNoteRoundContext,
    env: FieldNoteEnv,
    request: PublishFieldNoteRequest
  ): Promise<PublishFieldNoteResponse> {
    this.assertContributable(ctx, env);
    const secret = await this.repository.getOrCreateSecret(ctx.subredditId);
    const payload = verifyPreviewToken(secret, request.token, this.now().getTime());
    if (
      !payload ||
      payload.voterHash !== ctx.voterHash ||
      payload.seasonId !== ctx.seasonId ||
      payload.day !== ctx.day ||
      payload.postId !== ctx.postId
    ) {
      throw new FieldNoteError('invalid-token', 'This Field Note preview has expired or changed; preview it again');
    }
    const observation = findObservationForSensor(ctx.sensor, payload.observationId);
    if (!observation) throw new FieldNoteError('cross-sensor', 'That observation does not belong to your sense');
    const body = buildFieldNoteBody({
      sensor: payload.sensor,
      direction: payload.direction,
      confidence: payload.confidence,
      clause: observation.clause,
      ...(payload.commentary !== undefined ? { commentary: payload.commentary } : {}),
    });
    if (fieldNoteBodyHash(body) !== payload.bodyHash) {
      throw new FieldNoteError('invalid-token', 'The Field Note changed after preview; preview it again');
    }

    const prior = await this.repository.getIdempotent(ctx.subredditId, ctx.seasonId, ctx.day, ctx.voterHash, request.requestId);
    if (prior) return this.replayResponse(ctx, prior);

    return await this.repository.withPublishLease(ctx.subredditId, ctx.seasonId, ctx.day, ctx.voterHash, async () => {
      const replay = await this.repository.getIdempotent(ctx.subredditId, ctx.seasonId, ctx.day, ctx.voterHash, request.requestId);
      if (replay) return this.replayResponse(ctx, replay);
      const existing = await this.repository.getNote(ctx.subredditId, ctx.seasonId, ctx.day, ctx.voterHash);
      if (existing && existing.status === 'active') {
        return { status: 'already-active', mode: env.publishMode };
      }

      if (env.publishMode !== 'native') {
        return { status: 'copy-ready', mode: 'fallback', body, commentsUrl: commentsUrlFor(ctx.postId) };
      }
      return await this.publishNative(ctx, request, payload, body);
    });
  }

  private async publishNative(
    ctx: FieldNoteRoundContext,
    request: PublishFieldNoteRequest,
    payload: PreviewTokenPayload,
    body: string
  ): Promise<PublishFieldNoteResponse> {
    let parentId: string;
    let comment: { commentId: string; authorName: string; url: string | null };
    try {
      parentId = await this.repository.withParentLease(ctx.subredditId, ctx.seasonId, ctx.day, async () => {
        const existing = await this.repository.getParent(ctx.subredditId, ctx.seasonId, ctx.day);
        const id = await this.comments.ensureParentComment(ctx.postId, ctx.day, existing);
        if (id !== existing) await this.repository.setParent(ctx.subredditId, ctx.seasonId, ctx.day, id);
        return id;
      });
      comment = await this.comments.submitUserComment(parentId, body);
    } catch (error) {
      // Native path unavailable (scope/plugin missing) or Reddit failed: degrade
      // honestly to the copy fallback. The app never claims a user published.
      console.info('MURMUR field note fell back to copy mode', { day: ctx.day, reason: (error as Error).message });
      return { status: 'copy-ready', mode: 'fallback', body, commentsUrl: commentsUrlFor(ctx.postId) };
    }

    if (!ctx.username || comment.authorName.toLowerCase() !== ctx.username.toLowerCase()) {
      // The returned author is not the requesting user: never present it as theirs.
      console.info('MURMUR field note author mismatch; not indexed as user', { day: ctx.day });
      return { status: 'copy-ready', mode: 'fallback', body, commentsUrl: commentsUrlFor(ctx.postId) };
    }

    const index: FieldNoteIndex = {
      commentId: comment.commentId,
      parentCommentId: parentId,
      voterHash: ctx.voterHash,
      sensor: payload.sensor,
      direction: payload.direction,
      observationId: payload.observationId,
      confidence: payload.confidence,
      createdAt: this.now().toISOString(),
      status: 'active',
      schemaVersion: 1,
    };
    const commentUrl = comment.url ?? commentPermalink(ctx.postId, comment.commentId);
    await this.repository.saveNote(ctx.subredditId, ctx.seasonId, ctx.day, index, request.requestId, {
      commentId: comment.commentId,
      commentUrl,
    });
    return {
      status: 'published',
      mode: 'native',
      alreadyPublished: false,
      authorName: comment.authorName,
      commentUrl,
    };
  }

  /** Rebuilds the published response for an idempotent replay without any stored username. */
  private replayResponse(ctx: FieldNoteRoundContext, prior: IdempotentPublication): PublishFieldNoteResponse {
    return {
      status: 'published',
      mode: 'native',
      alreadyPublished: true,
      authorName: ctx.username ?? '',
      commentUrl: prior.commentUrl,
    };
  }

  async view(
    ctx: FieldNoteRoundContext,
    env: FieldNoteEnv,
    options: { minorityInsight: MinorityInsight | null }
  ): Promise<FieldNotesView> {
    const notes = env.enabled ? await this.repository.listActiveNotes(ctx.subredditId, ctx.seasonId, ctx.day) : [];
    const own = env.enabled && ctx.userId
      ? await this.repository.getNote(ctx.subredditId, ctx.seasonId, ctx.day, ctx.voterHash)
      : null;
    const alreadyContributed = own !== null && own.status === 'active';
    const parentId = env.enabled ? await this.repository.getParent(ctx.subredditId, ctx.seasonId, ctx.day) : null;
    const canContribute =
      env.enabled && Boolean(ctx.userId) && ctx.roundOpen && ctx.hasVoted && !alreadyContributed;
    // The reveal reasons only about structured notes the app actually indexes.
    // In fallback nothing is indexed, so claiming "too few Field Notes survived"
    // would be false: expose the reveal only where contributions are collectable.
    const revealAvailable = env.publishMode === 'native' || notes.length > 0;
    return {
      schemaVersion: FIELD_NOTE_SCHEMA_VERSION,
      enabled: env.enabled,
      publishMode: env.publishMode,
      authenticated: Boolean(ctx.userId),
      hasVoted: ctx.hasVoted,
      canContribute,
      alreadyContributed,
      sensor: ctx.userId ? ctx.sensor : null,
      observations: env.enabled && ctx.userId ? getObservationsForSensor(ctx.sensor) : [],
      authorName: env.publishMode === 'native' ? ctx.username : null,
      commentsUrl: commentsUrlFor(ctx.postId),
      parentThreadUrl: parentId ? commentPermalink(ctx.postId, parentId) : null,
      board: env.enabled ? buildFieldNoteBoard(notes) : null,
      minorityInsight: revealAvailable ? options.minorityInsight : null,
    };
  }

  private assertContributable(ctx: FieldNoteRoundContext, env: FieldNoteEnv): void {
    if (!env.enabled) throw new FieldNoteError('field-notes-disabled', 'Field Notes are not available right now');
    if (!ctx.roundOpen) throw new FieldNoteError('round-closed', 'This hollow has closed to new Field Notes');
    if (!ctx.hasVoted) throw new FieldNoteError('vote-required', 'Confirm your community signal before sharing a Field Note');
  }
}
