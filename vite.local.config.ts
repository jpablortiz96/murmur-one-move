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

let localVote: { direction: 'north' | 'east' | 'south' | 'west'; revision: number } | null = null;

const localCounts = () => {
  const counts = createEmptyCounts();
  if (localVote) {
    counts[localVote.direction] = 1;
    counts.total = 1;
  }
  return counts;
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
      currentVote: localVote?.direction ?? null,
      revision: localVote?.revision ?? 0,
      counts: localCounts(),
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
        if (routeUrl === '/local-reset' && request.method === 'POST') {
          localVote = null;
          response.statusCode = 204;
          response.end();
          return;
        }
        if (routeUrl.startsWith('/session')) {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(localSession()));
          return;
        }
        if (routeUrl === '/round/vote' && request.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const payload: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (
            typeof payload !== 'object' || payload === null ||
            !('direction' in payload) ||
            (payload.direction !== 'north' && payload.direction !== 'east' && payload.direction !== 'south' && payload.direction !== 'west')
          ) {
            response.statusCode = 400;
            response.end(JSON.stringify({ status: 'error', message: 'Invalid local vote fixture' }));
            return;
          }
          const direction = payload.direction;
          const changed = localVote?.direction !== direction;
          localVote = { direction, revision: changed ? (localVote?.revision ?? 0) + 1 : (localVote?.revision ?? 1) };
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({
            status: changed ? 'recorded' : 'unchanged',
            activeVote: {
              direction,
              sensor: localSensor(),
              signalQuality: 1,
              revision: localVote.revision,
              createdAt: '2026-07-13T15:00:00.000Z',
              updatedAt: '2026-07-13T15:00:00.000Z',
            },
            counts: localCounts(),
            roundStatus: 'open',
          }));
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
