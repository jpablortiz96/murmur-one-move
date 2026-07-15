import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import {
  CURRENT_CHAPTER_NUMBER,
  CURRENT_DAY,
  SENSOR_ASSIGNMENT_VERSION,
  SESSION_SCHEMA_VERSION,
  WORLD_GENERATOR_VERSION,
} from '../../shared/constants/game';
import { parsePostReferenceV2, type CombinedTruth, type ExpeditionPublicView } from '../../shared/contracts/expedition';
import { parsePlayerSession, type PlayerSession } from '../../shared/contracts/session';
import { CURRENT_FEATURE_FLAGS } from '../game/gameConfig';
import { getChapter } from '../game/expedition/chapters';
import { assignSensor } from '../game/sensors/assignSensor';
import { projectPerception } from '../game/sensors/projectPerception';
import { projectCombinedTruth } from '../game/world/combinedTruthProjector';
import { generateScenario } from '../game/world/generateScenario';
import { generateScenarioV2 } from '../game/world/generateScenarioV2';
import { validateScenario } from '../game/world/validateScenario';
import type { WorldTruth } from '../game/world/worldTypes';
import { getExpeditionCoordinator, getExpeditionRepository } from '../services/expeditionRuntime';
import { getContextRoundService, isCurrentUserModerator } from '../services/redditContext';
import { RoundServiceError } from '../services/roundService';

export const sessionApi = new Hono();

sessionApi.get('/', async (c) => {
  if (!context.postId || !context.subredditId) {
    return c.json({ status: 'error', message: 'Player session requires a Reddit post context' }, 503);
  }
  try {
    const reference = parsePostReferenceV2(context.postData);
    const day = reference?.murmur.day ?? CURRENT_DAY;
    const chapterNumber = reference ? day : CURRENT_CHAPTER_NUMBER;
    let truth: WorldTruth;
    let journey: ExpeditionPublicView | null = null;
    let combinedTruth: CombinedTruth | null = null;
    let v2Status: PlayerSession['expedition']['status'] | null = null;
    let v2CanVote = true;
    let v2CanResolve = true;

    if (reference) {
      const expedition = await getExpeditionRepository().get(context.subredditId, reference.murmur.seasonId);
      if (!expedition || expedition.postsByDay[String(day)] !== context.postId) {
        return c.json({ status: 'error', message: 'This chapter is no longer attached to its expedition' }, 409);
      }
      const scenario = expedition.scenarioByDay[String(day)];
      if (!scenario) throw new Error('Expedition chapter is missing its scenario identity');
      truth = generateScenarioV2(scenario);
      // The journey is projected from THIS post's day, so an older chapter never
      // renders as the day the expedition has since advanced to.
      journey = getExpeditionCoordinator().toPublicView(expedition, day);
      const isCurrentChapter = expedition.currentDay === day && expedition.currentPostId === context.postId;
      const windowOpen = Date.now() < Date.parse(expedition.window.closesAt);
      v2CanVote = isCurrentChapter && expedition.status === 'open' && windowOpen;
      v2CanResolve = isCurrentChapter && expedition.status === 'open';
      v2Status = isCurrentChapter ? expedition.status : 'resolved';
      const summary = expedition.history.find((item) => item.day === day);
      if (summary) {
        combinedTruth = projectCombinedTruth(
          truth,
          summary.winningDirection,
          summary.severity,
          summary.consequenceCopy
        );
      }
    } else {
      truth = generateScenario({
        postId: context.postId,
        chapter: CURRENT_CHAPTER_NUMBER,
        day: CURRENT_DAY,
        generatorVersion: WORLD_GENERATOR_VERSION,
      });
    }

    const validation = validateScenario(truth);
    if (!validation.valid) throw new Error(`Generated scenario failed validation: ${validation.reasons.join('; ')}`);
    const sensor = context.userId
      ? assignSensor({
          userId: context.userId,
          postId: context.postId,
          chapter: chapterNumber,
          day,
          assignmentVersion: SENSOR_ASSIGNMENT_VERSION,
        })
      : 'echo';
    const moderator = await isCurrentUserModerator();
    const state = await getContextRoundService().getState(context.userId, moderator);
    const status = v2Status ?? (state.status === 'resolved' ? 'resolved' : 'open');
    const response: PlayerSession = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      expedition: {
        chapter: chapterNumber,
        day,
        title: getChapter(day).name,
        status,
      },
      player: {
        authentication: context.userId ? 'authenticated' : 'guest',
        sensor,
        stableAssignment: context.userId !== undefined,
        assignmentVersion: SENSOR_ASSIGNMENT_VERSION,
      },
      perception: projectPerception(sensor, truth),
      round: {
        canVote: state.viewer.canVote && v2CanVote,
        canResolve: state.viewer.canResolve && v2CanResolve,
        canManage: moderator,
        currentVote: state.viewer.activeVote?.direction ?? null,
        revision: state.viewer.activeVote?.revision ?? 0,
        counts: state.counts,
        aggregateVisible: true,
        resolution: state.resolution,
      },
      journey,
      combinedTruth,
      featureFlags: { ...CURRENT_FEATURE_FLAGS },
    };
    const checked = parsePlayerSession(response);
    if (checked === null) throw new Error('Server produced an invalid private session projection');
    console.info('MURMUR private session served', {
      authenticated: response.player.authentication === 'authenticated',
      schemaVersion: reference ? 2 : 1,
      day,
      status,
    });
    return c.json<PlayerSession>(checked);
  } catch (error) {
    if (error instanceof RoundServiceError) {
      return c.json({ status: 'error', message: error.message }, error.code === 'round-unavailable' ? 503 : 500);
    }
    throw error;
  }
});
