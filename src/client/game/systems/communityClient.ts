import {
  parseResolveRoundResponse,
  parseSubmitVoteResponse,
  type ResolveRoundResponse,
  type SubmitVoteResponse,
} from '../../../shared/contracts/round';
import { parsePlayerSession, type PlayerSession } from '../../../shared/contracts/session';
import type { Direction } from '../../../shared/types/game';
import {
  parseExpeditionApiResponse,
  type ExpeditionApiResponse,
} from '../../../shared/contracts/expeditionApi';

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
  notifyCommunityUpdated();
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
  notifyCommunityUpdated();
  return result;
};

export const createVoteRequestId = (): string => crypto.randomUUID();

/** Signals the Field Notes overlay to re-read its capability/board state. */
const notifyCommunityUpdated = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('murmur:community-updated'));
  }
};

export const runModeratorExpeditionAction = async (
  path: 'round/close' | 'round/resolve' | 'chapter/publish' | 'expedition/reconcile',
  confirmation: 'CLOSE ROUND NOW' | 'RESOLVE NOW' | 'PUBLISH NEXT DAY' | 'RECONCILE'
): Promise<ExpeditionApiResponse> => {
  const response = await fetch(`/api/mod/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: crypto.randomUUID(), confirmation }),
  });
  await requireOk(response);
  const value: unknown = await response.json();
  const result = parseExpeditionApiResponse(value);
  if (!result) throw new CommunityApiError('Invalid moderator expedition response', 502);
  return result;
};
