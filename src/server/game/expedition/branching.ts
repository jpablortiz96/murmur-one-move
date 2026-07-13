import { createHash } from 'node:crypto';
import type { ExpeditionDaySummary, ScenarioIdentityV2 } from './expeditionTypes';

const canonicalHistory = (history: readonly ExpeditionDaySummary[]): string =>
  history
    .map((day) => `${day.day}:${day.winningDirection}:${day.severity}:${day.consequenceTag}:${day.roundAuditHash}`)
    .join('|');

export const computeBranchHash = (
  seasonId: string,
  history: readonly ExpeditionDaySummary[]
): string => `sha256:${createHash('sha256').update(`${seasonId}|${canonicalHistory(history)}`).digest('hex')}`;

export const createScenarioIdentityV2 = (
  seasonId: string,
  day: number,
  history: readonly ExpeditionDaySummary[],
  generatorVersion: number
): ScenarioIdentityV2 => ({
  seasonId,
  day,
  branchHash: computeBranchHash(seasonId, history),
  generatorVersion,
});
