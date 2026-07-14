import { createHash } from 'node:crypto';

const digest = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 24);

export type FieldNoteKeys = ReturnType<typeof createFieldNoteKeys>;

/**
 * Field Note keys are isolated by installation, season and day. Usernames, raw
 * user IDs and comment bodies are never used as keys or stored under them; only
 * hashed voter fields and minimal metadata live here.
 */
export const createFieldNoteKeys = (subredditId: string, seasonId: string, day: number) => {
  const installation = digest(subredditId);
  const season = digest(seasonId);
  const prefix = `murmur:v2:fn:${installation}:season:${season}:d${day}`;
  return {
    installation,
    prefix,
    secret: `murmur:v2:fn:${installation}:secret`,
    notes: `${prefix}:notes`,
    parent: `${prefix}:parent`,
    parentLease: `${prefix}:lease:parent`,
    publishLease: (voterHash: string) => `${prefix}:lease:publish:${voterHash}`,
    idempotency: (voterHash: string, requestId: string) => `${prefix}:req:${voterHash}:${digest(requestId)}`,
    commentIndex: (commentId: string) => `murmur:v2:fn:${installation}:comment:${digest(commentId)}`,
  };
};
