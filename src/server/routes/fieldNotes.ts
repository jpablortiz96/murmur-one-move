import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import { FIELD_NOTE_SCHEMA_VERSION, SENSOR_ASSIGNMENT_VERSION } from '../../shared/constants/game';
import { parsePostReferenceV2 } from '../../shared/contracts/expedition';
import {
  parseFieldNoteDraft,
  parsePublishFieldNoteRequest,
  type FieldNoteApiError,
  type FieldNotePreview,
  type FieldNotesView,
  type MinorityInsight,
  type PublishFieldNoteResponse,
} from '../../shared/contracts/fieldNotes';
import { FIELD_NOTES_CONFIG } from '../game/gameConfig';
import { computeMinorityInsight } from '../game/fieldNotes/minority';
import { assignSensor } from '../game/sensors/assignSensor';
import { generateScenarioV2 } from '../game/world/generateScenarioV2';
import { getExpeditionRepository } from '../services/expeditionRuntime';
import { getFieldNoteService, getFieldNoteRepository } from '../services/fieldNoteRuntime';
import { FieldNoteError, type FieldNoteEnv, type FieldNoteRoundContext } from '../services/fieldNoteService';
import { getContextRoundService } from '../services/redditContext';
import { createRoundIdentity } from '../services/roundService';
import { createRoundKeys, createVoterKey } from '../services/roundKeys';

export const fieldNotesApi = new Hono();

const ENV: FieldNoteEnv = { enabled: FIELD_NOTES_CONFIG.enabled, publishMode: FIELD_NOTES_CONFIG.publishMode };

const errorStatus = (code: FieldNoteApiError['code']): 400 | 401 | 403 | 409 | 503 => {
  switch (code) {
    case 'authentication-required':
      return 401;
    case 'vote-required':
      return 403;
    case 'already-active':
    case 'round-closed':
      return 409;
    case 'field-notes-disabled':
    case 'unavailable':
      return 503;
    default:
      return 400;
  }
};

const errorBody = (code: FieldNoteApiError['code'], message: string): FieldNoteApiError => ({
  status: 'error',
  code,
  message,
});

const disabledView = (): FieldNotesView => ({
  schemaVersion: FIELD_NOTE_SCHEMA_VERSION,
  enabled: false,
  publishMode: ENV.publishMode,
  authenticated: Boolean(context.userId),
  hasVoted: false,
  canContribute: false,
  alreadyContributed: false,
  sensor: null,
  observations: [],
  authorName: null,
  commentsUrl: null,
  parentThreadUrl: null,
  board: null,
  minorityInsight: null,
});

type ResolvedContext = {
  ctx: FieldNoteRoundContext;
  minorityInsight: MinorityInsight | null;
};

const resolveContext = async (): Promise<ResolvedContext | null> => {
  if (!context.postId || !context.subredditId || !context.subredditName) return null;
  const reference = parsePostReferenceV2(context.postData);
  if (!reference) return null;
  const { seasonId, day } = reference.murmur;
  const expedition = await getExpeditionRepository().get(context.subredditId, seasonId);
  if (!expedition || expedition.postsByDay[String(day)] !== context.postId) return null;

  const isCurrentChapter = expedition.currentDay === day && expedition.currentPostId === context.postId;
  const windowOpen = Date.now() < Date.parse(expedition.window.closesAt);
  const roundOpen = isCurrentChapter && expedition.status === 'open' && windowOpen;

  const userId = context.userId ?? '';
  const sensor = userId
    ? assignSensor({ userId, postId: context.postId, chapter: day, day, assignmentVersion: SENSOR_ASSIGNMENT_VERSION })
    : 'echo';
  const identity = createRoundIdentity(context.subredditId, context.postId, day, day);
  const voterHash = userId ? createVoterKey(createRoundKeys(identity).prefix, userId) : '';
  let hasVoted = false;
  if (userId) {
    const state = await getContextRoundService().getState(userId, false);
    hasVoted = state.viewer.activeVote !== null;
  }

  let minorityInsight: MinorityInsight | null = null;
  const summary = expedition.history.find((item) => item.day === day);
  const scenario = expedition.scenarioByDay[String(day)];
  if (summary && scenario) {
    const truth = generateScenarioV2(scenario);
    const notes = await getFieldNoteRepository().listActiveNotes(context.subredditId, seasonId, day);
    minorityInsight = computeMinorityInsight(
      truth.optimalDirection,
      summary.winningDirection,
      notes.map((note) => ({ direction: note.direction, sensor: note.sensor }))
    );
  }

  return {
    ctx: {
      subredditId: context.subredditId,
      subredditName: context.subredditName,
      seasonId,
      day,
      postId: context.postId,
      userId,
      username: context.username ?? null,
      voterHash,
      sensor,
      roundOpen,
      hasVoted,
    },
    minorityInsight,
  };
};

fieldNotesApi.get('/', async (c) => {
  const resolved = await resolveContext();
  if (!resolved) return c.json<FieldNotesView>(disabledView());
  const view = await getFieldNoteService().view(resolved.ctx, ENV, { minorityInsight: resolved.minorityInsight });
  return c.json<FieldNotesView>(view);
});

fieldNotesApi.post('/preview', async (c) => {
  if (!context.userId) return c.json<FieldNoteApiError>(errorBody('authentication-required', 'Sign in to write a Field Note'), 401);
  let payload: unknown;
  try {
    payload = await c.req.json<unknown>();
  } catch {
    return c.json<FieldNoteApiError>(errorBody('invalid-request', 'Field Note preview must contain valid JSON'), 400);
  }
  const draft = parseFieldNoteDraft(payload);
  if (!draft) return c.json<FieldNoteApiError>(errorBody('invalid-request', 'That Field Note is not valid'), 400);
  const resolved = await resolveContext();
  if (!resolved) return c.json<FieldNoteApiError>(errorBody('unavailable', 'Field Notes are unavailable for this post'), 503);
  try {
    const preview = await getFieldNoteService().preview(resolved.ctx, ENV, draft);
    return c.json<FieldNotePreview>(preview);
  } catch (error) {
    if (error instanceof FieldNoteError) return c.json<FieldNoteApiError>(errorBody(error.code, error.message), errorStatus(error.code));
    throw error;
  }
});

fieldNotesApi.post('/publish', async (c) => {
  if (!context.userId) return c.json<FieldNoteApiError>(errorBody('authentication-required', 'Sign in to publish a Field Note'), 401);
  let payload: unknown;
  try {
    payload = await c.req.json<unknown>();
  } catch {
    return c.json<FieldNoteApiError>(errorBody('invalid-request', 'Field Note publish must contain valid JSON'), 400);
  }
  const request = parsePublishFieldNoteRequest(payload);
  if (!request) return c.json<FieldNoteApiError>(errorBody('invalid-request', 'Field Note publish request is invalid'), 400);
  const resolved = await resolveContext();
  if (!resolved) return c.json<FieldNoteApiError>(errorBody('unavailable', 'Field Notes are unavailable for this post'), 503);
  try {
    const response = await getFieldNoteService().publish(resolved.ctx, ENV, request);
    console.info('MURMUR field note publish', { day: resolved.ctx.day, status: response.status, mode: response.mode });
    return c.json<PublishFieldNoteResponse>(response);
  } catch (error) {
    if (error instanceof FieldNoteError) return c.json<FieldNoteApiError>(errorBody(error.code, error.message), errorStatus(error.code));
    throw error;
  }
});
