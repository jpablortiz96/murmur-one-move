import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import { parsePostReferenceV2 } from '../../shared/contracts/expedition';
import { parseModeratorActionRequest, type ExpeditionApiResponse } from '../../shared/contracts/expeditionApi';
import { ExpeditionCoordinatorError } from '../services/expeditionCoordinator';
import { getExpeditionCoordinator, getExpeditionRepository } from '../services/expeditionRuntime';
import { isCurrentUserModerator } from '../services/redditContext';

export const moderatorApi = new Hono();

const CONFIRMATIONS = {
  start: 'OPEN TEST EXPEDITION',
  close: 'CLOSE ROUND NOW',
  resolve: 'RESOLVE NOW',
  publish: 'PUBLISH NEXT DAY',
  reconcile: 'RECONCILE',
} as const;

const requireModerator = async (): Promise<Response | null> => {
  if (!context.userId) return Response.json({ status: 'error', message: 'Sign in to use expedition controls' }, { status: 401 });
  if (!(await isCurrentUserModerator())) return Response.json({ status: 'error', message: 'Only community moderators can use expedition controls' }, { status: 403 });
  return null;
};

const readAction = async (c: { req: { json<T>(): Promise<T> } }, confirmation: string) => {
  let raw: unknown;
  try { raw = await c.req.json<unknown>(); } catch { return null; }
  const request = parseModeratorActionRequest(raw);
  return request?.confirmation === confirmation ? request : null;
};

const requireContext = (): { subredditId: string; subredditName: string } | null =>
  context.subredditId && context.subredditName
    ? { subredditId: context.subredditId, subredditName: context.subredditName }
    : null;

moderatorApi.post('/expedition/start', async (c) => {
  const forbidden = await requireModerator();
  if (forbidden) return forbidden;
  const request = await readAction(c, CONFIRMATIONS.start);
  const installation = requireContext();
  if (!request || !installation) return c.json({ status: 'error', message: 'Explicit start confirmation is required' }, 400);
  const coordinator = getExpeditionCoordinator();
  const state = await coordinator.start({ ...installation, now: new Date(), operationId: request.requestId });
  console.info('MURMUR expedition opened', { seasonId: state.seasonId, day: state.currentDay, status: state.status });
  return c.json<ExpeditionApiResponse>({
    status: 'ok', expedition: coordinator.toPublicView(state),
    navigateTo: state.currentPostId ? `https://reddit.com/comments/${state.currentPostId.replace(/^t3_/, '')}` : null,
  });
});

const withActive = async () => {
  const installation = requireContext();
  if (!installation) return null;
  const reference = parsePostReferenceV2(context.postData);
  const repository = getExpeditionRepository();
  const state = reference
    ? await repository.get(installation.subredditId, reference.murmur.seasonId)
    : await repository.getActive(installation.subredditId);
  // Moderator responses replace the client's journey, so they must be projected
  // from the post the moderator is actually inside, not the expedition's day.
  const viewedDay = reference?.murmur.day ?? state?.currentDay;
  return state ? { installation, state, viewedDay, coordinator: getExpeditionCoordinator() } : null;
};

moderatorApi.post('/round/close', async (c) => {
  const forbidden = await requireModerator(); if (forbidden) return forbidden;
  const request = await readAction(c, CONFIRMATIONS.close); const active = await withActive();
  if (!request || !active) return c.json({ status: 'error', message: 'Active expedition and explicit close confirmation are required' }, 400);
  const state = await active.coordinator.closeRound(active.state.subredditId, active.state.seasonId, request.requestId);
  return c.json<ExpeditionApiResponse>({ status: 'ok', expedition: active.coordinator.toPublicView(state, active.viewedDay), navigateTo: null });
});

moderatorApi.post('/round/resolve', async (c) => {
  const forbidden = await requireModerator(); if (forbidden) return forbidden;
  const request = await readAction(c, CONFIRMATIONS.resolve); const active = await withActive();
  if (!request || !active) return c.json({ status: 'error', message: 'Active expedition and explicit resolve confirmation are required' }, 400);
  try {
    const state = await active.coordinator.resolve({
      subredditId: active.state.subredditId, seasonId: active.state.seasonId,
      day: active.state.currentDay, operationId: request.requestId, force: true,
    });
    console.info('MURMUR expedition day resolved', { seasonId: state.seasonId, day: state.currentDay, status: state.status });
    return c.json<ExpeditionApiResponse>({ status: 'ok', expedition: active.coordinator.toPublicView(state, active.viewedDay), navigateTo: null });
  } catch (error) {
    // A zero-signal round is refused rather than resolved into an invented winner.
    if (error instanceof ExpeditionCoordinatorError && error.code === 'no-signals') {
      return c.json({ status: 'error', message: error.message }, 409);
    }
    throw error;
  }
});

moderatorApi.post('/chapter/publish', async (c) => {
  const forbidden = await requireModerator(); if (forbidden) return forbidden;
  const request = await readAction(c, CONFIRMATIONS.publish); const active = await withActive();
  if (!request || !active) return c.json({ status: 'error', message: 'Active expedition and explicit publish confirmation are required' }, 400);
  const state = await active.coordinator.publishNext(active.state.subredditId, active.state.seasonId, request.requestId);
  console.info('MURMUR expedition chapter published', { seasonId: state.seasonId, day: state.currentDay, status: state.status });
  return c.json<ExpeditionApiResponse>({
    status: 'ok', expedition: active.coordinator.toPublicView(state, active.viewedDay),
    navigateTo: state.currentPostId ? `https://reddit.com/comments/${state.currentPostId.replace(/^t3_/, '')}` : null,
  });
});

moderatorApi.post('/expedition/reconcile', async (c) => {
  const forbidden = await requireModerator(); if (forbidden) return forbidden;
  const request = await readAction(c, CONFIRMATIONS.reconcile); const installation = requireContext();
  if (!request || !installation) return c.json({ status: 'error', message: 'Explicit reconcile confirmation is required' }, 400);
  const coordinator = getExpeditionCoordinator();
  const state = await coordinator.reconcile(installation.subredditId, request.requestId);
  if (!state) return c.json({ status: 'error', message: 'No expedition exists to reconcile' }, 404);
  console.info('MURMUR expedition reconciled', { seasonId: state.seasonId, day: state.currentDay, status: state.status });
  const viewedDay = parsePostReferenceV2(context.postData)?.murmur.day ?? state.currentDay;
  return c.json<ExpeditionApiResponse>({ status: 'ok', expedition: coordinator.toPublicView(state, viewedDay), navigateTo: null });
});

moderatorApi.get('/expedition/state', async (c) => {
  const forbidden = await requireModerator(); if (forbidden) return forbidden;
  const active = await withActive();
  if (!active) return c.json({ status: 'error', message: 'No active expedition exists' }, 404);
  return c.json<ExpeditionApiResponse>({ status: 'ok', expedition: active.coordinator.toPublicView(active.state, active.viewedDay), navigateTo: null });
});
