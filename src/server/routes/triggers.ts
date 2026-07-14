import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { getExpeditionRepository } from '../services/expeditionRuntime';
import { getFieldNoteRepository } from '../services/fieldNoteRuntime';

export const triggers = new Hono();

const readString = (value: unknown, key: string): string | null => {
  if (typeof value !== 'object' || value === null) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.length > 0 ? field : null;
};

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

// A native Field Note comment was deleted on Reddit. Desindex it so it stops
// counting toward the board and the minority reveal. Idempotent and safe for
// duplicate or out-of-order delivery and unindexed comments.
triggers.post('/on-comment-delete', async (c) => {
  try {
    const input = await c.req.json<unknown>();
    const commentId = readString(input, 'commentId');
    if (commentId && context.subredditId) {
      const wasIndexed = await getFieldNoteRepository().markCommentDeleted(context.subredditId, commentId);
      if (wasIndexed) console.info('MURMUR field note desindexed after deletion');
    }
  } catch (error) {
    console.error(`Error handling comment deletion: ${error}`);
  }
  return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
});

// A chapter post was deleted. Desindex every Field Note attached to that day of
// the active expedition; retain no comment text.
triggers.post('/on-post-delete', async (c) => {
  try {
    const input = await c.req.json<unknown>();
    const postId = readString(input, 'postId');
    if (postId && context.subredditId) {
      const expedition = await getExpeditionRepository().getActive(context.subredditId);
      if (expedition) {
        const entry = Object.entries(expedition.postsByDay).find(([, id]) => id === postId);
        if (entry) {
          const purged = await getFieldNoteRepository().purgeDay(context.subredditId, expedition.seasonId, Number(entry[0]));
          if (purged > 0) console.info('MURMUR field notes desindexed after post deletion', { purged });
        }
      }
    }
  } catch (error) {
    console.error(`Error handling post deletion: ${error}`);
  }
  return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
});
