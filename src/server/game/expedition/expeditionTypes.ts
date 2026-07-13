import type {
  ConsequenceSeverity,
  ConsequenceTag,
  ExpeditionEnding,
  ExpeditionStatus,
  MurmurCondition,
  RoundWindow,
} from '../../../shared/contracts/expedition';
import type { CommunityCounts } from '../../../shared/contracts/round';
import type { Direction } from '../../../shared/types/game';

export type ScenarioIdentityV2 = {
  seasonId: string;
  day: number;
  branchHash: string;
  generatorVersion: number;
};

export type ExpeditionTransition = {
  from: ExpeditionStatus;
  to: ExpeditionStatus;
  previousRevision: number;
  nextRevision: number;
  at: string;
  cause: string;
  operationId: string;
  auditHash: string;
};

export type ExpeditionDaySummary = {
  day: number;
  postId: string;
  winningDirection: Direction;
  counts: CommunityCounts;
  severity: ConsequenceSeverity;
  consequenceTag: ConsequenceTag;
  consequenceCopy: string;
  branchHash: string;
  scenarioIdentity: ScenarioIdentityV2;
  resolvedAt: string;
  roundAuditHash: string;
};

export type ExpeditionState = {
  schemaVersion: 2;
  seasonId: string;
  subredditId: string;
  subredditName: string;
  status: ExpeditionStatus;
  currentDay: number;
  totalDays: 7;
  currentPostId: string | null;
  previousPostIds: string[];
  postsByDay: Record<string, string>;
  scenarioByDay: Record<string, ScenarioIdentityV2>;
  window: RoundWindow;
  murmur: {
    vitality: number;
    condition: MurmurCondition;
    memoryFragments: number;
    scars: ConsequenceTag[];
  };
  history: ExpeditionDaySummary[];
  transitions: ExpeditionTransition[];
  ending: ExpeditionEnding | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  revision: number;
};

export type PostReferenceV2 = {
  murmur: {
    v: 2;
    seasonId: string;
    day: number;
    generatorVersion: number;
  };
};

export type TransitionCommand = {
  to: ExpeditionStatus;
  expectedRevision: number;
  cause: string;
  operationId: string;
  at: string;
};
