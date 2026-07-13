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

export const api = new Hono();

api.route('/round', roundApi);

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
    featureFlags: {
      echoEnabled: true,
      heatEnabled: false,
      windEnabled: false,
      dailyResolutionEnabled: false,
      manualResolutionEnabled: true,
      communityPersistenceEnabled: true,
      privateSensorsEnabled: false,
    },
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
