import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required to create a MURMUR post');
  }

  return await reddit.submitCustomPost({
    subredditName,
    title: 'MURMUR: One Move a Day — Echo Signal',
    entry: 'default',
  });
};
