import { defineConfig, type Plugin } from 'vite';
import { api } from './src/server/routes/api';
import { CURRENT_FEATURE_FLAGS } from './src/server/game/gameConfig';
import { projectPerception } from './src/server/game/sensors/projectPerception';
import { generateScenario } from './src/server/game/world/generateScenario';
import { createEmptyCounts } from './src/shared/contracts/round';
import type { PlayerSession } from './src/shared/contracts/session';
import type { Sensor } from './src/shared/types/game';

const localSensor = (): Sensor => {
  const value = process.env.MURMUR_LOCAL_SENSOR;
  return value === 'heat' || value === 'wind' ? value : 'echo';
};

const localSession = (): PlayerSession => {
  const sensor = localSensor();
  const truth = generateScenario({ postId: 'local-visual-harness', chapter: 1, day: 1, generatorVersion: 1 });
  return {
    schemaVersion: 1,
    expedition: { chapter: 1, day: 1, title: 'The First Hollow', status: 'open' },
    player: { authentication: 'authenticated', sensor, stableAssignment: true, assignmentVersion: 1 },
    perception: projectPerception(sensor, truth),
    round: {
      canVote: true,
      canResolve: false,
      currentVote: null,
      revision: 0,
      counts: createEmptyCounts(),
      aggregateVisible: true,
      resolution: null,
    },
    featureFlags: { ...CURRENT_FEATURE_FLAGS },
  };
};

const localApiPlugin: Plugin = {
  name: 'murmur-local-api',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/api/')) {
        next();
        return;
      }

      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(key, item);
          } else if (typeof value === 'string') {
            headers.set(key, value);
          }
        }

        const routeUrl = request.url.slice('/api'.length);
        if (routeUrl.startsWith('/session')) {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(localSession()));
          return;
        }
        if (routeUrl.startsWith('/round')) {
          response.statusCode = 503;
          response.setHeader('Content-Type', 'application/json');
          response.end(
            JSON.stringify({
              status: 'error',
              code: 'round-unavailable',
              message: 'Community Redis is available only inside a Reddit playtest',
            })
          );
          return;
        }
        const apiResponse = await api.fetch(
          new Request(`http://127.0.0.1:4173${routeUrl}`, {
            method: request.method ?? 'GET',
            headers,
          })
        );
        response.statusCode = apiResponse.status;
        apiResponse.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(Buffer.from(await apiResponse.arrayBuffer()));
      } catch (error) {
        next(error);
      }
    });
  },
};

export default defineConfig({
  root: 'src/client',
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  plugins: [localApiPlugin],
});
