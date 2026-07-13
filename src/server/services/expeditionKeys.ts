import { createHash } from 'node:crypto';

const digest = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 24);

export type ExpeditionKeys = ReturnType<typeof createExpeditionKeys>;

export const createExpeditionKeys = (subredditId: string, seasonId: string) => {
  const installation = digest(subredditId);
  const season = digest(seasonId);
  const prefix = `murmur:v2:${installation}:season:${season}`;
  return {
    installation,
    prefix,
    activeSeason: `murmur:v2:${installation}:active-season`,
    activeLease: `murmur:v2:${installation}:lease:active-season`,
    state: `${prefix}:state`,
    stateLease: `${prefix}:lease:state`,
    transition: (day: number, action: 'resolve' | 'publish-next') => `${prefix}:transition:${day}:${action}`,
    post: (day: number) => `${prefix}:post:${day}`,
    publishIntent: (day: number) => `${prefix}:intent:publish:${day}`,
    resolveLease: (day: number) => `${prefix}:lease:resolve:${day}`,
    publishLease: (day: number) => `${prefix}:lease:publish:${day}`,
    scheduledJob: (day: number, name: 'resolve-round' | 'publish-next-chapter') =>
      `${prefix}:scheduled:${day}:${name}`,
    job: (jobId: string) => `${prefix}:job:${digest(jobId)}`,
  };
};
