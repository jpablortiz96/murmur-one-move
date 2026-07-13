import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import type { ExpeditionApiResponse } from '../../shared/contracts/expeditionApi';
import { getExpeditionCoordinator, getExpeditionRepository } from '../services/expeditionRuntime';

export const expeditionApi = new Hono();

expeditionApi.get('/', async (c) => {
  if (!context.subredditId) return c.json({ status: 'error', message: 'Expedition context is unavailable' }, 503);
  const state = await getExpeditionRepository().getActive(context.subredditId);
  if (!state) return c.json({ status: 'error', message: 'No expedition has opened in this community' }, 404);
  const coordinator = getExpeditionCoordinator();
  return c.json<ExpeditionApiResponse>({
    status: 'ok', expedition: coordinator.toPublicView(state), navigateTo: null,
  });
});
