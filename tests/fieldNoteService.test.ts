import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { FieldNoteRepository } from '../src/server/services/fieldNoteRepository';
import {
  FieldNoteError,
  FieldNoteService,
  type CommentGateway,
  type FieldNoteEnv,
  type FieldNoteRoundContext,
} from '../src/server/services/fieldNoteService';
import type { FieldNoteDraft } from '../src/shared/contracts/fieldNotes';

const test = createDevvitTest();

class FakeComments implements CommentGateway {
  parentCalls = 0;
  readonly userComments: Array<{ parentId: string; body: string }> = [];
  authorName = 'alice';
  failNative = false;

  async ensureParentComment(_postId: string, day: number, existing: string | null): Promise<string> {
    if (existing) return existing;
    this.parentCalls += 1;
    return `t1_parent_${day}`;
  }

  async submitUserComment(parentId: string, body: string): Promise<{ commentId: string; authorName: string; url: string | null }> {
    if (this.failNative) throw new Error('native user action unavailable');
    this.userComments.push({ parentId, body });
    return { commentId: `t1_c${this.userComments.length}`, authorName: this.authorName, url: null };
  }
}

const NATIVE: FieldNoteEnv = { enabled: true, publishMode: 'native' };
const FALLBACK: FieldNoteEnv = { enabled: true, publishMode: 'fallback' };

const ctx = (over: Partial<FieldNoteRoundContext> = {}): FieldNoteRoundContext => ({
  subredditId: 't5_fn',
  subredditName: 'murmur_test',
  seasonId: 'season-fn-01',
  day: 2,
  postId: 't3_fnpost',
  userId: 't2_alice',
  username: 'alice',
  voterHash: 'voter-alice',
  sensor: 'heat',
  roundOpen: true,
  hasVoted: true,
  ...over,
});

const heatDraft = (over: Partial<FieldNoteDraft> = {}): FieldNoteDraft => ({
  direction: 'east',
  confidence: 'high',
  observationId: 'moving-warmth',
  ...over,
});

const build = (comments = new FakeComments()) => {
  let tick = 0;
  const repository = new FieldNoteRepository(redis);
  const service = new FieldNoteService(repository, comments, () => new Date(Date.UTC(2026, 6, 14, 12, 0, tick++)));
  return { repository, service, comments };
};

test('preview recalculates the body and issues a verifiable token', async () => {
  const { service } = build();
  const preview = await service.preview(ctx(), NATIVE, heatDraft({ commentary: '  something is pacing  ' }));
  expect(preview.body).toContain('**HEAT FIELD NOTE · EAST**');
  expect(preview.body).toContain('> something is pacing');
  expect(preview.authorName).toBe('alice');
  expect(preview.token.split('.')).toHaveLength(2);
});

test('preview rejects an observation from another sensor', async () => {
  const { service } = build();
  await expect(service.preview(ctx({ sensor: 'heat' }), NATIVE, heatDraft({ observationId: 'deep-hollow' }))).rejects.toMatchObject<
    Partial<FieldNoteError>
  >({ code: 'cross-sensor' });
});

test('preview requires an open round and a prior vote', async () => {
  const { service } = build();
  await expect(service.preview(ctx({ hasVoted: false }), NATIVE, heatDraft())).rejects.toMatchObject({ code: 'vote-required' });
  await expect(service.preview(ctx({ roundOpen: false }), NATIVE, heatDraft())).rejects.toMatchObject({ code: 'round-closed' });
});

test('native publish creates exactly one attributed comment and is idempotent', async () => {
  const { service, comments } = build();
  const preview = await service.preview(ctx(), NATIVE, heatDraft());
  const first = await service.publish(ctx(), NATIVE, { token: preview.token, requestId: 'req_alice_0001' });
  const repeat = await service.publish(ctx(), NATIVE, { token: preview.token, requestId: 'req_alice_0001' });
  expect(first).toMatchObject({ status: 'published', mode: 'native', authorName: 'alice' });
  expect(repeat.status).toBe('published');
  expect(comments.userComments).toHaveLength(1);
  expect(comments.parentCalls).toBe(1);
});

test('two concurrent publishes still create only one comment', async () => {
  const { service, comments } = build();
  const preview = await service.preview(ctx(), NATIVE, heatDraft());
  const results = await Promise.all([
    service.publish(ctx(), NATIVE, { token: preview.token, requestId: 'req_alice_aaaa' }),
    service.publish(ctx(), NATIVE, { token: preview.token, requestId: 'req_alice_bbbb' }),
  ]);
  expect(comments.userComments).toHaveLength(1);
  expect(results.filter((result) => result.status === 'published')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'already-active')).toHaveLength(1);
});

test('a second note by the same user in the same chapter is refused', async () => {
  const { service } = build();
  const preview = await service.preview(ctx(), NATIVE, heatDraft());
  await service.publish(ctx(), NATIVE, { token: preview.token, requestId: 'req_alice_0001' });
  await expect(service.preview(ctx(), NATIVE, heatDraft({ direction: 'west' }))).rejects.toMatchObject({ code: 'already-active' });
});

test('fallback mode never posts and never indexes a contribution', async () => {
  const { service, comments, repository } = build();
  const preview = await service.preview(ctx(), FALLBACK, heatDraft());
  const result = await service.publish(ctx(), FALLBACK, { token: preview.token, requestId: 'req_alice_0001' });
  expect(result).toMatchObject({ status: 'copy-ready', mode: 'fallback' });
  expect(comments.userComments).toHaveLength(0);
  expect(await repository.getNote('t5_fn', 'season-fn-01', 2, 'voter-alice')).toBeNull();
});

test('an unexpected author is not presented as the user and is not indexed', async () => {
  const comments = new FakeComments();
  comments.authorName = 'not_alice';
  const { service, repository } = build(comments);
  const preview = await service.preview(ctx(), NATIVE, heatDraft());
  const result = await service.publish(ctx(), NATIVE, { token: preview.token, requestId: 'req_alice_0001' });
  expect(result.status).toBe('copy-ready');
  expect(await repository.getNote('t5_fn', 'season-fn-01', 2, 'voter-alice')).toBeNull();
});

test('a native failure degrades honestly to the copy fallback', async () => {
  const comments = new FakeComments();
  comments.failNative = true;
  const { service, repository } = build(comments);
  const preview = await service.preview(ctx(), NATIVE, heatDraft());
  const result = await service.publish(ctx(), NATIVE, { token: preview.token, requestId: 'req_alice_0001' });
  expect(result.status).toBe('copy-ready');
  expect(await repository.getNote('t5_fn', 'season-fn-01', 2, 'voter-alice')).toBeNull();
});

test('a tampered token cannot be published', async () => {
  const { service } = build();
  const preview = await service.preview(ctx(), NATIVE, heatDraft());
  const forged = `${preview.token.split('.')[0]}.${'0'.repeat(64)}`;
  await expect(service.publish(ctx(), NATIVE, { token: forged, requestId: 'req_alice_0001' })).rejects.toMatchObject({
    code: 'invalid-token',
  });
});

test('the board hides breakdowns below three notes and reveals them at threshold', async () => {
  const { service, comments } = build();
  const users = [
    { userId: 't2_a', username: 'a', voterHash: 'vh-a', sensor: 'heat' as const },
    { userId: 't2_b', username: 'b', voterHash: 'vh-b', sensor: 'echo' as const },
    { userId: 't2_c', username: 'c', voterHash: 'vh-c', sensor: 'wind' as const },
  ];
  const twoNoteView = await (async () => {
    for (const [index, user] of users.slice(0, 2).entries()) {
      comments.authorName = user.username;
      const c = ctx(user);
      const preview = await service.preview(c, NATIVE, heatDraft({ observationId: user.sensor === 'echo' ? 'deep-hollow' : user.sensor === 'wind' ? 'clean-outflow' : 'moving-warmth' }));
      await service.publish(c, NATIVE, { token: preview.token, requestId: `req_${user.username}_00000001` });
    }
    return service.view(ctx(users[2]), NATIVE, { minorityInsight: null });
  })();
  expect(twoNoteView.board?.totalNotes).toBe(2);
  expect(twoNoteView.board?.thresholdMet).toBe(false);
  expect(twoNoteView.board?.bySensor).toBeNull();

  const thirdUser = users[2]!;
  comments.authorName = thirdUser.username;
  const thirdPreview = await service.preview(ctx(thirdUser), NATIVE, heatDraft({ observationId: 'clean-outflow' }));
  await service.publish(ctx(thirdUser), NATIVE, { token: thirdPreview.token, requestId: 'req_c_00000001' });
  const view = await service.view(ctx({ userId: 't2_d', username: 'd', voterHash: 'vh-d' }), NATIVE, { minorityInsight: null });
  expect(view.board?.thresholdMet).toBe(true);
  expect(view.board?.bySensor).toEqual({ echo: 1, heat: 1, wind: 1 });
});
