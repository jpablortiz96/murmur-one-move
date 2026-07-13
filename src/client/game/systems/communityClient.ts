import {
  parseResolveRoundResponse,
  parseSubmitVoteResponse,
  type ResolveRoundResponse,
  type SubmitVoteResponse,
} from '../../../shared/contracts/round';
import { parsePlayerSession, type PlayerSession } from '../../../shared/contracts/session';
import type { Direction } from '../../../shared/types/game';

export class CommunityApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CommunityApiError';
    this.status = status;
  }
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const value: unknown = await response.json();
    if (
      typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      typeof value.message === 'string'
    ) {
      return value.message;
    }
  } catch {
    // The status code remains actionable even when an upstream body is not JSON.
  }
  return `Community request returned HTTP ${response.status}`;
};

const requireOk = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new CommunityApiError(await readErrorMessage(response), response.status);
  }
};

export const fetchPlayerSession = async (): Promise<PlayerSession> => {
  const response = await fetch('/api/session', { headers: { Accept: 'application/json' } });
  await requireOk(response);
  const value: unknown = await response.json();
  const session = parsePlayerSession(value);
  if (session === null) throw new CommunityApiError('Invalid private session response', 502);
  return session;
};

export const submitCommunityVote = async (
  direction: Direction,
  requestId: string
): Promise<SubmitVoteResponse> => {
  const response = await fetch('/api/round/vote', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction, requestId }),
  });
  await requireOk(response);
  const value: unknown = await response.json();
  const result = parseSubmitVoteResponse(value);
  if (result === null) throw new CommunityApiError('Invalid vote response', 502);
  return result;
};

export const resolveCommunityRound = async (): Promise<ResolveRoundResponse> => {
  const response = await fetch('/api/round/resolve', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  await requireOk(response);
  const value: unknown = await response.json();
  const result = parseResolveRoundResponse(value);
  if (result === null) throw new CommunityApiError('Invalid resolution response', 502);
  return result;
};

export const createVoteRequestId = (): string => crypto.randomUUID();
