import { createHash } from 'node:crypto';
import type { ExpeditionStatus } from '../../../shared/contracts/expedition';
import type { ExpeditionState, TransitionCommand } from './expeditionTypes';

const ALLOWED: Record<ExpeditionStatus, readonly ExpeditionStatus[]> = {
  scheduled: ['open'],
  open: ['resolving'],
  resolving: ['resolved'],
  resolved: ['next-chapter-pending'],
  'next-chapter-pending': ['open', 'completed'],
  completed: [],
};

export class ExpeditionTransitionError extends Error {
  readonly code: 'invalid-transition' | 'stale-revision' | 'operation-conflict';

  constructor(code: ExpeditionTransitionError['code'], message: string) {
    super(message);
    this.name = 'ExpeditionTransitionError';
    this.code = code;
  }
}

const transitionHash = (state: ExpeditionState, command: TransitionCommand): string =>
  `sha256:${createHash('sha256').update(JSON.stringify({
    seasonId: state.seasonId,
    from: state.status,
    to: command.to,
    previousRevision: state.revision,
    at: command.at,
    cause: command.cause,
    operationId: command.operationId,
  })).digest('hex')}`;

export const transitionExpedition = (
  state: ExpeditionState,
  command: TransitionCommand
): { state: ExpeditionState; changed: boolean } => {
  const existing = state.transitions.find((transition) => transition.operationId === command.operationId);
  if (existing) {
    if (existing.to !== command.to) {
      throw new ExpeditionTransitionError('operation-conflict', 'Operation ID already targets another state');
    }
    return { state, changed: false };
  }
  if (command.expectedRevision !== state.revision) {
    throw new ExpeditionTransitionError('stale-revision', 'Expedition revision changed before transition');
  }
  if (!ALLOWED[state.status].includes(command.to)) {
    throw new ExpeditionTransitionError('invalid-transition', `Cannot transition ${state.status} to ${command.to}`);
  }
  const nextRevision = state.revision + 1;
  const transition = {
    from: state.status,
    to: command.to,
    previousRevision: state.revision,
    nextRevision,
    at: command.at,
    cause: command.cause,
    operationId: command.operationId,
    auditHash: transitionHash(state, command),
  };
  return {
    changed: true,
    state: {
      ...state,
      status: command.to,
      revision: nextRevision,
      updatedAt: command.at,
      transitions: [...state.transitions, transition],
      completedAt: command.to === 'completed' ? command.at : state.completedAt,
    },
  };
};
