import { Hono } from 'hono';
import {
  APP_VERSION,
  AVAILABLE_DIRECTIONS,
  AVAILABLE_SENSORS,
  GAME_TAGLINE,
  GAME_TITLE,
} from '../../shared/constants/game';
import type {
  ApiErrorResponse,
  BootstrapResponse,
  HealthResponse,
} from '../../shared/contracts/bootstrap';
import { roundApi } from './round';
import { sessionApi } from './session';
import { CURRENT_FEATURE_FLAGS } from '../game/gameConfig';

export const api = new Hono();

api.route('/round', roundApi);
api.route('/session', sessionApi);

api.get('/health', (c) =>
  c.json<HealthResponse>({
    status: 'ok',
    version: APP_VERSION,
    serverTime: new Date().toISOString(),
  })
);

api.get('/bootstrap', (c) => {
  const response: BootstrapResponse = {
    gameTitle: GAME_TITLE,
    tagline: GAME_TAGLINE,
    chapter: 'The First Hollow',
    day: 1,
    serverTime: new Date().toISOString(),
    availableSensors: [...AVAILABLE_SENSORS],
    availableDirections: [...AVAILABLE_DIRECTIONS],
    featureFlags: { ...CURRENT_FEATURE_FLAGS },
  };
  console.info('MURMUR bootstrap served', {
    chapter: response.chapter,
    day: response.day,
  });
  return c.json<BootstrapResponse>(response);
});

api.notFound((c) =>
  c.json<ApiErrorResponse>(
    { status: 'error', message: 'API route not found' },
    404
  )
);
