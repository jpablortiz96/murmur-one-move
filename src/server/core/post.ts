import { randomUUID } from 'node:crypto';
import { context } from '@devvit/web/server';
import { getExpeditionCoordinator } from '../services/expeditionRuntime';

export const createPost = async (): Promise<{ id: string }> => {
  const { subredditId, subredditName } = context;
  if (!subredditId || !subredditName) {
    throw new Error('Installation context is required to open a MURMUR expedition');
  }
  const coordinator = getExpeditionCoordinator();
  const active = await coordinator.getActive(subredditId);
  if (active && active.status !== 'completed' && active.currentPostId) {
    return { id: active.currentPostId };
  }
  const state = await coordinator.start({
    subredditId,
    subredditName,
    now: new Date(),
    operationId: `open:${randomUUID()}`,
  });
  if (!state.currentPostId) throw new Error('Expedition opened without a chapter post');
  return { id: state.currentPostId };
};
