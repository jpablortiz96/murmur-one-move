import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import {
  CURRENT_CHAPTER_NUMBER,
  CURRENT_DAY,
  SENSOR_ASSIGNMENT_VERSION,
  SESSION_SCHEMA_VERSION,
  WORLD_GENERATOR_VERSION,
} from '../../shared/constants/game';
import { parsePlayerSession, type PlayerSession } from '../../shared/contracts/session';
import { CURRENT_FEATURE_FLAGS } from '../game/gameConfig';
import { assignSensor } from '../game/sensors/assignSensor';
import { projectPerception } from '../game/sensors/projectPerception';
import { generateScenario } from '../game/world/generateScenario';
import { validateScenario } from '../game/world/validateScenario';
import { getContextRoundService, isCurrentUserModerator } from '../services/redditContext';
import { RoundServiceError } from '../services/roundService';

export const sessionApi = new Hono();

sessionApi.get('/', async (c) => {
  if (!context.postId || !context.subredditId) {
    return c.json({ status: 'error', message: 'Player session requires a Reddit post context' }, 503);
  }
  try {
    const identity = {
      postId: context.postId,
      chapter: CURRENT_CHAPTER_NUMBER,
      day: CURRENT_DAY,
      generatorVersion: WORLD_GENERATOR_VERSION,
    };
    const truth = generateScenario(identity);
    const validation = validateScenario(truth);
    if (!validation.valid) throw new Error(`Generated scenario failed validation: ${validation.reasons.join('; ')}`);
    const sensor = context.userId
      ? assignSensor({
          userId: context.userId,
          postId: context.postId,
          chapter: CURRENT_CHAPTER_NUMBER,
          day: CURRENT_DAY,
          assignmentVersion: SENSOR_ASSIGNMENT_VERSION,
        })
      : 'echo';
    const canResolve = await isCurrentUserModerator();
    const state = await getContextRoundService().getState(context.userId, canResolve);
    const response: PlayerSession = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      expedition: {
        chapter: CURRENT_CHAPTER_NUMBER,
        day: CURRENT_DAY,
        title: 'The First Hollow',
        status: state.status === 'resolved' ? 'resolved' : 'open',
      },
      player: {
        authentication: context.userId ? 'authenticated' : 'guest',
        sensor,
        stableAssignment: context.userId !== undefined,
        assignmentVersion: SENSOR_ASSIGNMENT_VERSION,
      },
      perception: projectPerception(sensor, truth),
      round: {
        canVote: state.viewer.canVote,
        canResolve: state.viewer.canResolve,
        currentVote: state.viewer.activeVote?.direction ?? null,
        revision: state.viewer.activeVote?.revision ?? 0,
        counts: state.counts,
        aggregateVisible: true,
        resolution: state.resolution,
      },
      featureFlags: { ...CURRENT_FEATURE_FLAGS },
    };
    const checked = parsePlayerSession(response);
    if (checked === null) throw new Error('Server produced an invalid private session projection');
    console.info('MURMUR private session served', {
      authenticated: response.player.authentication === 'authenticated',
      day: response.expedition.day,
      status: response.expedition.status,
    });
    return c.json<PlayerSession>(checked);
  } catch (error) {
    if (error instanceof RoundServiceError) {
      return c.json({ status: 'error', message: error.message }, error.code === 'round-unavailable' ? 503 : 500);
    }
    throw error;
  }
});
