import { context } from '@devvit/web/server';
import { Hono } from 'hono';
import {
  parseSubmitVoteRequest,
  type ResolveRoundResponse,
  type RoundApiError,
  type SubmitVoteResponse,
} from '../../shared/contracts/round';
import { getContextRoundService, isCurrentUserModerator } from '../services/redditContext';
import { RoundServiceError } from '../services/roundService';

export const roundApi = new Hono();

const errorStatus = (
  error: RoundServiceError
): 409 | 500 | 503 => {
  if (error.code === 'round-resolved' || error.code === 'idempotency-conflict') {
    return 409;
  }
  return error.code === 'round-unavailable' ? 503 : 500;
};

const serviceError = (error: RoundServiceError) => ({
  body: {
    status: 'error',
    code: error.code,
    message: error.message,
  } satisfies RoundApiError,
  status: errorStatus(error),
});

roundApi.post('/vote', async (c) => {
  if (!context.userId) {
    return c.json<RoundApiError>(
      {
        status: 'error',
        code: 'authentication-required',
        message: 'Sign in to Reddit to confirm a community signal',
      },
      401
    );
  }
  let payload: unknown;
  try {
    payload = await c.req.json<unknown>();
  } catch {
    return c.json<RoundApiError>(
      {
        status: 'error',
        code: 'invalid-request',
        message: 'Vote request must contain valid JSON',
      },
      400
    );
  }
  const request = parseSubmitVoteRequest(payload);
  if (request === null) {
    return c.json<RoundApiError>(
      {
        status: 'error',
        code: 'invalid-request',
        message: 'Direction or request ID is invalid',
      },
      400
    );
  }
  try {
    const response = await getContextRoundService().submitVote(context.userId, request);
    console.info('MURMUR vote committed', {
      postId: context.postId,
      direction: response.activeVote.direction,
      revision: response.activeVote.revision,
      total: response.counts.total,
      status: response.status,
    });
    return c.json<SubmitVoteResponse>(response);
  } catch (error) {
    if (error instanceof RoundServiceError) {
      const response = serviceError(error);
      return c.json<RoundApiError>(response.body, response.status);
    }
    throw error;
  }
});

roundApi.post('/resolve', async (c) => {
  if (!context.userId) {
    return c.json<RoundApiError>(
      {
        status: 'error',
        code: 'authentication-required',
        message: 'Sign in to resolve this round',
      },
      401
    );
  }
  if (!(await isCurrentUserModerator())) {
    return c.json<RoundApiError>(
      {
        status: 'error',
        code: 'moderator-required',
        message: 'Only a moderator of this community can resolve the round',
      },
      403
    );
  }
  try {
    const response = await getContextRoundService().resolve();
    console.info('MURMUR round resolved', {
      postId: context.postId,
      direction: response.resolution.winningDirection,
      total: response.resolution.countsSnapshot.total,
      auditHash: response.resolution.auditHash,
      alreadyResolved: response.alreadyResolved,
    });
    return c.json<ResolveRoundResponse>(response);
  } catch (error) {
    if (error instanceof RoundServiceError) {
      const response = serviceError(error);
      return c.json<RoundApiError>(response.body, response.status);
    }
    throw error;
  }
});
