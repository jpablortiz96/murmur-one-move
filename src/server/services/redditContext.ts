import { context, reddit, redis } from '@devvit/web/server';
import { SENSOR_ASSIGNMENT_VERSION } from '../../shared/constants/game';
import { assignSensor } from '../game/sensors/assignSensor';
import {
  createRoundIdentity,
  RoundService,
  RoundServiceError,
} from './roundService';

export const getContextRoundService = (): RoundService => {
  if (!context.postId || !context.subredditId) {
    throw new RoundServiceError(
      'round-unavailable',
      'Round context is unavailable outside a Reddit post'
    );
  }
  const identity = createRoundIdentity(context.subredditId, context.postId);
  return new RoundService({
    redis,
    identity,
    sensorForUser: (userId) => assignSensor({
      userId,
      postId: identity.postId,
      chapter: identity.chapter,
      day: identity.day,
      assignmentVersion: SENSOR_ASSIGNMENT_VERSION,
    }),
  });
};

export const isCurrentUserModerator = async (): Promise<boolean> => {
  if (!context.userId || !context.subredditName) return false;
  const username = context.username ?? (await reddit.getCurrentUser())?.username;
  if (!username) return false;
  const moderators = await reddit
    .getModerators({
      subredditName: context.subredditName,
      username,
      limit: 1,
      pageSize: 1,
    })
    .get(1);
  return moderators.length === 1;
};
