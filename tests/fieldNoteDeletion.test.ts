import { redis } from '@devvit/web/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { expect } from 'vitest';
import { FieldNoteRepository } from '../src/server/services/fieldNoteRepository';
import {
  FieldNoteService,
  type CommentGateway,
  type FieldNoteEnv,
  type FieldNoteRoundContext,
} from '../src/server/services/fieldNoteService';

const test = createDevvitTest();

class FakeComments implements CommentGateway {
  count = 0;
  authorName = 'alice';
  async ensureParentComment(_postId: string, day: number, existing: string | null): Promise<string> {
    return existing ?? `t1_parent_${day}`;
  }
  async submitUserComment(): Promise<{ commentId: string; authorName: string; url: string | null }> {
    this.count += 1;
    return { commentId: `t1_c${this.count}`, authorName: this.authorName, url: null };
  }
}

const NATIVE: FieldNoteEnv = { enabled: true, publishMode: 'native' };

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

const build = () => {
  let tick = 0;
  const comments = new FakeComments();
  const repository = new FieldNoteRepository(redis);
  const service = new FieldNoteService(repository, comments, () => new Date(Date.UTC(2026, 6, 14, 12, 0, tick++)));
  return { repository, service, comments };
};

const publishOne = async (service: FieldNoteService, comments: FakeComments, user: Partial<FieldNoteRoundContext>, observationId: string) => {
  const c = ctx(user);
  comments.authorName = c.username ?? '';
  const preview = await service.preview(c, NATIVE, { direction: 'east', confidence: 'high', observationId });
  return service.publish(c, NATIVE, { token: preview.token, requestId: `req_${c.voterHash}_${observationId}` });
};

test('deleting a comment desindexes it and excludes it from active notes', async () => {
  const { service, comments, repository } = build();
  const result = await publishOne(service, comments, {}, 'moving-warmth');
  expect(result.status).toBe('published');
  const commentId = comments.count === 1 ? 't1_c1' : '';
  expect(await repository.markCommentDeleted('t5_fn', commentId)).toBe(true);
  const note = await repository.getNote('t5_fn', 'season-fn-01', 2, 'voter-alice');
  expect(note?.status).toBe('deleted');
  expect(await repository.listActiveNotes('t5_fn', 'season-fn-01', 2)).toHaveLength(0);
});

test('duplicate and out-of-order deletion events are safe no-ops', async () => {
  const { service, comments, repository } = build();
  await publishOne(service, comments, {}, 'moving-warmth');
  expect(await repository.markCommentDeleted('t5_fn', 't1_c1')).toBe(true);
  expect(await repository.markCommentDeleted('t5_fn', 't1_c1')).toBe(true); // duplicate
  expect(await repository.markCommentDeleted('t5_fn', 't1_never_indexed')).toBe(false); // unindexed / out of order
});

test('a user may share a new note after their previous one was deleted', async () => {
  const { service, comments, repository } = build();
  await publishOne(service, comments, {}, 'moving-warmth');
  await repository.markCommentDeleted('t5_fn', 't1_c1');
  const second = await publishOne(service, comments, {}, 'rising-heat');
  expect(second.status).toBe('published');
  const active = await repository.listActiveNotes('t5_fn', 'season-fn-01', 2);
  expect(active).toHaveLength(1);
  expect(active[0]?.observationId).toBe('rising-heat');
});

test('a manually pasted fallback comment is unknown to the index and cannot be desindexed', async () => {
  const { repository } = build();
  // Fallback publishes nothing through the app, so no reverse index ever exists
  // for a comment the player pasted themselves: deletion is a no-op by design.
  expect(await repository.markCommentDeleted('t5_fn', 't1_manually_pasted')).toBe(false);
  expect(await repository.listActiveNotes('t5_fn', 'season-fn-01', 2)).toHaveLength(0);
});

test('deleting a chapter post purges every active note for that day', async () => {
  const { service, comments, repository } = build();
  await publishOne(service, comments, { userId: 't2_a', username: 'a', voterHash: 'vh-a' }, 'moving-warmth');
  await publishOne(service, comments, { userId: 't2_b', username: 'b', voterHash: 'vh-b' }, 'rising-heat');
  const purged = await repository.purgeDay('t5_fn', 'season-fn-01', 2);
  expect(purged).toBe(2);
  expect(await repository.listActiveNotes('t5_fn', 'season-fn-01', 2)).toHaveLength(0);
});
