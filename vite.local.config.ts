import { defineConfig, type Plugin } from 'vite';
import { api } from './src/server/routes/api';
import { CURRENT_FEATURE_FLAGS } from './src/server/game/gameConfig';
import { buildFieldNoteBody } from './src/server/game/fieldNotes/noteBody';
import {
  findObservationForSensor,
  getObservationsForSensor,
} from './src/server/game/fieldNotes/observations';
import { commentsUrlFor } from './src/server/services/fieldNoteService';
import { projectPerception } from './src/server/game/sensors/projectPerception';
import { generateScenario } from './src/server/game/world/generateScenario';
import { createEmptyCounts } from './src/shared/contracts/round';
import type { PlayerSession } from './src/shared/contracts/session';
import type { ExpeditionPublicView, ExpeditionStatus } from './src/shared/contracts/expedition';
import type { RoundResolution } from './src/shared/contracts/round';
import type { Sensor } from './src/shared/types/game';

const localSensor = (): Sensor => {
  const value = process.env.MURMUR_LOCAL_SENSOR;
  return value === 'heat' || value === 'wind' ? value : 'echo';
};

let localVote: { direction: 'north' | 'east' | 'south' | 'west'; revision: number } | null = null;

const localExpeditionStatus = (): ExpeditionStatus => {
  const value = process.env.MURMUR_LOCAL_EXPEDITION_STATE;
  return value === 'resolving' || value === 'resolved' || value === 'next-chapter-pending' || value === 'completed'
    ? value
    : 'open';
};

const localJourney = (): ExpeditionPublicView => {
  const status = localExpeditionStatus();
  const completed = status === 'completed';
  const historyLength = completed ? 7 : status === 'open' || status === 'resolving' ? 2 : 3;
  return {
    schemaVersion: 2,
    seasonId: 'season-local-evidence',
    status,
    currentDay: completed ? 7 : 3,
    totalDays: 7,
    chapter: {
      day: completed ? 7 : 3,
      name: completed ? 'The Last Resonance' : 'The Sleeping Heat',
      phrase: 'Warmth moves where nothing should be alive.',
      cavernType: 'thermal nursery',
      cliffhanger: 'A choir begins without voices.',
    },
    window: {
      opensAt: '2026-07-13T15:00:00.000Z',
      closesAt: '2026-07-14T13:00:00.000Z',
      revealAt: '2026-07-14T13:02:00.000Z',
      nextChapterAt: '2026-07-14T13:12:00.000Z',
    },
    murmur: {
      vitality: completed ? 1 : 2,
      condition: completed ? 'strained' : 'stable',
      memoryFragments: completed ? 3 : 2,
      scars: completed ? ['fractured-shell', 'spore-mark'] : ['spore-mark'],
    },
    history: Array.from({ length: historyLength }, (_, index) => ({
      day: index + 1,
      direction: (['north', 'east', 'south', 'west'] as const)[index % 4] ?? 'north',
      severity: (['safe', 'costly', 'dangerous'] as const)[index % 3] ?? 'safe',
      consequence: 'The hollow changed Murmur without ending the signal.',
      resolvedAt: `2026-07-${String(13 + index).padStart(2, '0')}T18:00:00.000Z`,
    })),
    ending: completed ? 'the-survivor' : null,
    schedulerDelayed: false,
    nextChapterPostId: status === 'open' ? 't3_local_day_3' : null,
  };
};

const localResolution = (): RoundResolution => ({
  status: 'resolved', winningDirection: 'east',
  countsSnapshot: { north: 2, east: 5, south: 1, west: 2, total: 10 },
  sensorDiversityByDirection: { north: 1, east: 3, south: 1, west: 2 },
  tieBreak: 'vote-count', tiedDirections: ['east'],
  resolvedAt: '2026-07-15T18:00:00.000Z', resolutionVersion: 1,
  auditHash: `sha256:${'a'.repeat(64)}`,
});

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
  const journey = localJourney();
  const resolved = journey.status === 'resolved' || journey.status === 'next-chapter-pending' || journey.status === 'completed';
  const resolution = resolved ? localResolution() : null;
  const truth = generateScenario({ postId: 'local-visual-harness', chapter: 1, day: 1, generatorVersion: 1 });
  return {
    schemaVersion: 2,
    expedition: { chapter: journey.currentDay, day: journey.currentDay, title: journey.chapter.name, status: journey.status },
    player: { authentication: 'authenticated', sensor, stableAssignment: true, assignmentVersion: 1 },
    perception: projectPerception(sensor, truth),
    round: {
      canVote: journey.status === 'open',
      canResolve: journey.status === 'open',
      canManage: true,
      currentVote: resolution?.winningDirection ?? localVote?.direction ?? null,
      revision: localVote?.revision ?? 0,
      counts: resolution?.countsSnapshot ?? localCounts(),
      aggregateVisible: true,
      resolution,
    },
    journey,
    combinedTruth: resolved && process.env.MURMUR_LOCAL_HIDE_REVEAL !== '1' ? {
      echo: 'East was open, hollow, and stable.',
      heat: 'East held burning air with a moving signature.',
      wind: 'East carried clear air in an inward current.',
      consequence: 'Murmur crossed, but the living heat marked its shell.',
      severity: 'dangerous',
    } : null,
    featureFlags: { ...CURRENT_FEATURE_FLAGS },
  };
};

const LOCAL_POST_ID = 't3_local_chapter';

/**
 * Harness-only Field Notes fixtures. They never change production behaviour;
 * MURMUR_LOCAL_BAD_COMMENTS_URL forces an unparseable destination so the
 * navigation error path can be captured deterministically.
 */
const localCommentsUrl = (): string =>
  process.env.MURMUR_LOCAL_BAD_COMMENTS_URL === '1'
    ? 'murmur-local-broken-destination'
    : commentsUrlFor(LOCAL_POST_ID);

const localFieldNotesView = () => ({
  schemaVersion: 1,
  enabled: true,
  publishMode: 'fallback' as const,
  authenticated: true,
  hasVoted: localVote !== null,
  canContribute: localVote !== null,
  alreadyContributed: false,
  sensor: localSensor(),
  observations: getObservationsForSensor(localSensor()),
  authorName: null,
  commentsUrl: localCommentsUrl(),
  parentThreadUrl: null,
  board: { totalNotes: 0, thresholdMet: false, bySensor: null, byDirection: null },
  minorityInsight: null,
});

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
        if (routeUrl === '/field-notes' && (request.method ?? 'GET') === 'GET') {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(localFieldNotesView()));
          return;
        }
        if (routeUrl === '/field-notes/preview' && request.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const draft: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const sensor = localSensor();
          const record = draft as { direction?: string; confidence?: string; observationId?: string; commentary?: string };
          const observation = findObservationForSensor(sensor, record.observationId ?? '');
          if (!observation || !record.direction || !record.confidence) {
            response.statusCode = 400;
            response.end(JSON.stringify({ status: 'error', code: 'invalid-request', message: 'Invalid local Field Note fixture' }));
            return;
          }
          const body = buildFieldNoteBody({
            sensor,
            direction: record.direction as 'north' | 'east' | 'south' | 'west',
            confidence: record.confidence as 'low' | 'medium' | 'high',
            clause: observation.clause,
            ...(record.commentary ? { commentary: record.commentary } : {}),
          });
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({
            schemaVersion: 1,
            body,
            destination: { postId: LOCAL_POST_ID, commentsUrl: localCommentsUrl(), parentKnown: false },
            publishMode: 'fallback',
            authorName: null,
            token: 'local-harness-preview-token',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          }));
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
