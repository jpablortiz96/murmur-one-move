import { createHash } from 'node:crypto';
import type { RoundIdentity } from '../../shared/contracts/round';

export type RoundKeys = {
  prefix: string;
  meta: string;
  votes: string;
  idempotency: string;
  resolution: string;
  writeLease: string;
};

const digest = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const createRoundKeys = (identity: RoundIdentity): RoundKeys => {
  const postKey = digest(identity.postId).slice(0, 24);
  const prefix = `murmur:v${identity.schemaVersion}:round:${postKey}:c${identity.chapter}:d${identity.day}`;
  return {
    prefix,
    meta: `${prefix}:meta`,
    votes: `${prefix}:votes`,
    idempotency: `${prefix}:requests`,
    resolution: `${prefix}:resolution`,
    writeLease: `${prefix}:write-lease`,
  };
};

export const createVoterKey = (roundPrefix: string, userId: string): string =>
  digest(`${roundPrefix}|voter|${userId}`);

export const createIdempotencyKey = (
  roundPrefix: string,
  voterKey: string,
  requestId: string
): string => digest(`${roundPrefix}|request|${voterKey}|${requestId}`);

export const createAuditHash = (canonicalPayload: string): string =>
  `sha256:${digest(canonicalPayload)}`;
