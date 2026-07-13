import { context } from '@devvit/web/server';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { Hono } from 'hono';
import { getExpeditionCoordinator, getExpeditionRepository } from '../services/expeditionRuntime';

type ExpeditionTaskData = {
  seasonId: string;
  subredditId: string;
  day: number;
  operationId: string;
};

const parseTask = (value: unknown): ExpeditionTaskData | null => {
  if (typeof value !== 'object' || value === null || !('data' in value) ||
    typeof value.data !== 'object' || value.data === null) return null;
  const data = value.data;
  if (!('seasonId' in data) || typeof data.seasonId !== 'string' ||
    !('subredditId' in data) || typeof data.subredditId !== 'string' ||
    !('day' in data) || typeof data.day !== 'number' || !Number.isInteger(data.day) ||
    !('operationId' in data) || typeof data.operationId !== 'string') return null;
  return { seasonId: data.seasonId, subredditId: data.subredditId, day: data.day, operationId: data.operationId };
};

const requireInstallation = (data: ExpeditionTaskData): boolean =>
  context.subredditId === data.subredditId;

export const schedulerRoutes = new Hono();

schedulerRoutes.post('/resolve-round', async (c) => {
  const request: unknown = await c.req.json<TaskRequest<ExpeditionTaskData>>();
  const data = parseTask(request);
  if (!data || !requireInstallation(data)) return c.json({ status: 'error', message: 'Invalid scheduler round identity' }, 400);
  await getExpeditionCoordinator().resolve({
    subredditId: data.subredditId, seasonId: data.seasonId, day: data.day,
    operationId: data.operationId,
  });
  return c.json<TaskResponse>({});
});

schedulerRoutes.post('/publish-next-chapter', async (c) => {
  const request: unknown = await c.req.json<TaskRequest<ExpeditionTaskData>>();
  const data = parseTask(request);
  if (!data || !requireInstallation(data)) return c.json({ status: 'error', message: 'Invalid scheduler chapter identity' }, 400);
  const state = await getExpeditionRepository().get(data.subredditId, data.seasonId);
  if (!state) return c.json({ status: 'error', message: 'Scheduled expedition no longer exists' }, 404);
  if (state.currentDay + 1 !== data.day && !(state.currentDay === data.day && state.status === 'open')) {
    return c.json({ status: 'error', message: 'Scheduled chapter targets a stale day' }, 409);
  }
  await getExpeditionCoordinator().publishNext(data.subredditId, data.seasonId, data.operationId);
  return c.json<TaskResponse>({});
});

schedulerRoutes.post('/reconcile-expedition', async (c) => {
  const request: unknown = await c.req.json<TaskRequest<undefined>>();
  if (!('name' in (request as object)) || !context.subredditId) return c.json({ status: 'error', message: 'Invalid reconcile task' }, 400);
  await getExpeditionCoordinator().reconcile(context.subredditId, `cron-reconcile:${new Date().toISOString().slice(0, 16)}`);
  return c.json<TaskResponse>({});
});
