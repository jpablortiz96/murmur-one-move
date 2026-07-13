import { context, reddit, redis, scheduler } from '@devvit/web/server';
import { SENSOR_ASSIGNMENT_VERSION } from '../../shared/constants/game';
import { parsePostReferenceV2 } from '../../shared/contracts/expedition';
import { assignSensor } from '../game/sensors/assignSensor';
import { PRODUCTION_WINDOW, TEST_WINDOW } from '../game/expedition/windows';
import { ExpeditionCoordinator, type ChapterPostGateway, type ExpeditionRoundGateway, type ExpeditionScheduler } from './expeditionCoordinator';
import { ExpeditionRepository } from './expeditionRepository';
import { createRoundIdentity, RoundService } from './roundService';

const TEST_SUBREDDIT = 'murmur_one_move_dev';
const isRedditPostId = (value: string): value is `t3_${string}` => value.startsWith('t3_');

const postGateway: ChapterPostGateway = {
  async find(seasonId, day, subredditName) {
    const candidates = await reddit.getNewPosts({ subredditName, limit: 100, pageSize: 50 }).all();
    for (const post of candidates) {
      const reference = parsePostReferenceV2(await post.getPostData());
      if (reference?.murmur.seasonId === seasonId && reference.murmur.day === day) return post.id;
    }
    return null;
  },
  async create(spec) {
    const post = await reddit.submitCustomPost(spec);
    return post.id;
  },
  async updateFallback(postId, text) {
    if (!isRedditPostId(postId)) throw new Error('Expedition stored an invalid Reddit post ID');
    await (await reddit.getPostById(postId)).setTextFallback({ text });
  },
};

const expeditionScheduler: ExpeditionScheduler = {
  async schedule(name, data, runAt) {
    return await scheduler.runJob({ name, data, runAt });
  },
};

const createRoundService = (subredditId: string, postId: string, day: number): RoundService => {
  const identity = createRoundIdentity(subredditId, postId, day, day);
  return new RoundService({
    redis,
    identity,
    sensorForUser: (userId) => assignSensor({
      userId, postId, chapter: day, day, assignmentVersion: SENSOR_ASSIGNMENT_VERSION,
    }),
  });
};

const roundGateway: ExpeditionRoundGateway = {
  async get(subredditId, postId, day) {
    return await createRoundService(subredditId, postId, day).getState(undefined, false);
  },
  async resolve(subredditId, postId, day) {
    return await createRoundService(subredditId, postId, day).resolve();
  },
};

export const getExpeditionRepository = (): ExpeditionRepository => new ExpeditionRepository(redis);

export const getExpeditionCoordinator = (): ExpeditionCoordinator => new ExpeditionCoordinator(
  redis,
  getExpeditionRepository(),
  postGateway,
  expeditionScheduler,
  roundGateway,
  context.subredditName === TEST_SUBREDDIT ? TEST_WINDOW : PRODUCTION_WINDOW
);
