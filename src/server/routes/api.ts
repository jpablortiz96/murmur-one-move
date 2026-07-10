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

export const api = new Hono();

api.get('/health', (c) =>
  c.json<HealthResponse>({
    status: 'ok',
    version: APP_VERSION,
    serverTime: new Date().toISOString(),
  })
);

api.get('/bootstrap', (c) =>
  c.json<BootstrapResponse>({
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
      communityPersistenceEnabled: false,
      privateSensorsEnabled: false,
    },
  })
);

api.notFound((c) =>
  c.json<ApiErrorResponse>(
    { status: 'error', message: 'API route not found' },
    404
  )
);

