import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';

export const menu = new Hono();

/**
 * Reddit comment URLs address a post by its base36 id, not by the stored `t3_`
 * thing prefix, so the id is normalized the same way moderator navigation does.
 */
export const createPostNavigateUrl = (subredditName: string, postId: string): string =>
  `https://reddit.com/r/${subredditName}/comments/${postId.replace(/^t3_/, '')}`;

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: createPostNavigateUrl(String(context.subredditName), post.id),
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});
