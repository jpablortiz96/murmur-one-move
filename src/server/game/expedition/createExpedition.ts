import { randomUUID } from 'node:crypto';
import { EXPEDITION_DAYS } from '../../../shared/contracts/expedition';
import { WORLD_GENERATOR_VERSION } from '../../../shared/constants/game';
import { createScenarioIdentityV2 } from './branching';
import type { ExpeditionState } from './expeditionTypes';
import { createRoundWindow, PRODUCTION_WINDOW, type WindowProfile } from './windows';

export type CreateExpeditionInput = {
  subredditId: string;
  subredditName: string;
  now: Date;
  seasonId?: string;
  windowProfile?: WindowProfile;
};

export const createExpedition = (input: CreateExpeditionInput): ExpeditionState => {
  const seasonId = input.seasonId ?? `season-${randomUUID()}`;
  const timestamp = input.now.toISOString();
  const scenario = createScenarioIdentityV2(seasonId, 1, [], WORLD_GENERATOR_VERSION + 1);
  return {
    schemaVersion: 2,
    seasonId,
    subredditId: input.subredditId,
    subredditName: input.subredditName,
    status: 'scheduled',
    currentDay: 1,
    totalDays: EXPEDITION_DAYS,
    currentPostId: null,
    previousPostIds: [],
    postsByDay: {},
    scenarioByDay: { '1': scenario },
    window: createRoundWindow(input.now, input.windowProfile ?? PRODUCTION_WINDOW),
    murmur: { vitality: 3, condition: 'stable', memoryFragments: 0, scars: [] },
    history: [],
    transitions: [],
    ending: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    revision: 0,
  };
};
