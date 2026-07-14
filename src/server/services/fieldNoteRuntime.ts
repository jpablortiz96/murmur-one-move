import { reddit, redis } from '@devvit/web/server';
import { createFieldNotesParentBody } from '../game/fieldNotes/parentThread';
import { FieldNoteRepository } from './fieldNoteRepository';
import { FieldNoteService, type CommentGateway } from './fieldNoteService';

const isT3 = (value: string): value is `t3_${string}` => value.startsWith('t3_');
const isT1 = (value: string): value is `t1_${string}` => value.startsWith('t1_');

const commentGateway: CommentGateway = {
  async ensureParentComment(postId, day, existing) {
    if (existing) return existing;
    if (!isT3(postId)) throw new Error('Field Notes require a valid Reddit post ID');
    const parent = await reddit.submitComment({ id: postId, text: createFieldNotesParentBody(day) });
    return parent.id;
  },
  async submitUserComment(parentId, body) {
    if (!isT1(parentId)) throw new Error('Field Notes require a valid parent comment ID');
    const comment = await reddit.submitComment({ id: parentId, text: body, runAs: 'USER' });
    return { commentId: comment.id, authorName: comment.authorName, url: null };
  },
};

export const getFieldNoteRepository = (): FieldNoteRepository => new FieldNoteRepository(redis);

export const getFieldNoteService = (): FieldNoteService =>
  new FieldNoteService(getFieldNoteRepository(), commentGateway);
