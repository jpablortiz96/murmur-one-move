import { randomUUID } from 'node:crypto';
import type { RedisClient, TxClientLike } from '@devvit/web/server';
import {
  AVAILABLE_DIRECTIONS,
  CURRENT_CHAPTER_NUMBER,
  CURRENT_DAY,
  ROUND_RESOLUTION_VERSION,
  ROUND_SCHEMA_VERSION,
} from '../../shared/constants/game';
import {
  createEmptyCounts,
  parseActiveVote,
  parseCommunityCounts,
  type ActiveVote,
  type CommunityCounts,
  type ResolveRoundResponse,
  type RoundIdentity,
  type RoundResolution,
  type RoundStateResponse,
  type RoundStatus,
  type SubmitVoteRequest,
  type SubmitVoteResponse,
  type TieBreak,
} from '../../shared/contracts/round';
import type { Direction, Sensor } from '../../shared/types/game';
import {
  createAuditHash,
  createIdempotencyKey,
  createRoundKeys,
  createVoterKey,
} from './roundKeys';

type RoundRedis = Pick<
  RedisClient,
  'get' | 'set' | 'del' | 'hGet' | 'hGetAll' | 'watch'
>;

type RoundMeta = {
  identity: RoundIdentity;
  status: RoundStatus;
};

type IdempotencyRecord = {
  direction: Direction;
  revision: number;
};

const isDirection = (value: unknown): value is Direction =>
  typeof value === 'string' &&
  AVAILABLE_DIRECTIONS.some((direction) => direction === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseSensorDiversity = (
  value: unknown
): Record<Direction, number> | null => {
  if (!isRecord(value)) return null;
  const values = AVAILABLE_DIRECTIONS.map((direction) => value[direction]);
  if (
    !values.every(
      (count) =>
        typeof count === 'number' &&
        Number.isSafeInteger(count) &&
        count >= 0
    )
  ) {
    return null;
  }
  const [north, east, south, west] = values;
  if (
    typeof north !== 'number' ||
    typeof east !== 'number' ||
    typeof south !== 'number' ||
    typeof west !== 'number'
  ) {
    return null;
  }
  return { north, east, south, west };
};

const firstDirection = (directions: readonly Direction[]): Direction => {
  const direction = directions[0];
  if (direction === undefined) {
    throw new RoundServiceError('storage-failure', 'Winner calculation produced no direction');
  }
  return direction;
};

type RoundServiceOptions = {
  redis: RoundRedis;
  identity: RoundIdentity;
  now?: () => Date;
  sensorForUser: (userId: string) => Sensor;
  maxTransactionAttempts?: number;
};

export class RoundServiceError extends Error {
  readonly code:
    | 'round-resolved'
    | 'idempotency-conflict'
    | 'round-unavailable'
    | 'storage-failure';

  constructor(
    code: RoundServiceError['code'],
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'RoundServiceError';
    this.code = code;
  }
}

const safeParseJson = (raw: string, label: string): unknown => {
  try {
    const value: unknown = JSON.parse(raw);
    return value;
  } catch (error) {
    throw new RoundServiceError(
      'storage-failure',
      `Stored ${label} is not valid JSON`,
      { cause: error }
    );
  }
};

const parseMeta = (raw: string | undefined, identity: RoundIdentity): RoundMeta => {
  if (raw === undefined) return { identity, status: 'open' };
  const value = safeParseJson(raw, 'round metadata');
  if (
    typeof value !== 'object' ||
    value === null ||
    !('identity' in value) ||
    !('status' in value) ||
    typeof value.identity !== 'object' ||
    value.identity === null ||
    !('postId' in value.identity) ||
    !('chapter' in value.identity) ||
    !('day' in value.identity) ||
    !('schemaVersion' in value.identity) ||
    value.identity.postId !== identity.postId ||
    value.identity.chapter !== identity.chapter ||
    value.identity.day !== identity.day ||
    value.identity.schemaVersion !== identity.schemaVersion ||
    (value.status !== 'open' &&
      value.status !== 'resolving' &&
      value.status !== 'resolved')
  ) {
    throw new RoundServiceError('storage-failure', 'Stored round metadata is invalid');
  }
  return { identity, status: value.status };
};

const parseStoredVote = (raw: string | undefined): ActiveVote | null => {
  if (raw === undefined) return null;
  const vote = parseActiveVote(safeParseJson(raw, 'active vote'));
  if (vote === null) {
    throw new RoundServiceError('storage-failure', 'Stored active vote is invalid');
  }
  return vote;
};

const parseIdempotency = (raw: string | undefined): IdempotencyRecord | null => {
  if (raw === undefined) return null;
  const value = safeParseJson(raw, 'idempotency record');
  if (
    typeof value !== 'object' ||
    value === null ||
    !('direction' in value) ||
    !isDirection(value.direction) ||
    !('revision' in value) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1
  ) {
    throw new RoundServiceError('storage-failure', 'Stored idempotency record is invalid');
  }
  return { direction: value.direction, revision: value.revision };
};

const isTransactionConflict = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('transaction') &&
    (message.includes('abort') || message.includes('watch') || message.includes('conflict'))
  );
};

const executeTransaction = async (
  transaction: TxClientLike,
  expectedCommands: number
): Promise<boolean> => {
  const results = await transaction.exec();
  return Array.isArray(results) && results.length === expectedCommands;
};

const countVotes = (votes: ReadonlyArray<ActiveVote>): CommunityCounts => {
  const counts = createEmptyCounts();
  for (const vote of votes) {
    counts[vote.direction] += 1;
    counts.total += 1;
  }
  return counts;
};

const parseVoteCollection = (
  entries: ReadonlyArray<readonly [string, string]>
): ActiveVote[] =>
  entries.map(([, raw]) => {
    const vote = parseStoredVote(raw);
    if (vote === null) {
      throw new RoundServiceError('storage-failure', 'Vote collection contains an empty record');
    }
    return vote;
  });

const chooseWinner = (
  counts: CommunityCounts,
  votes: ReadonlyArray<ActiveVote>,
  seed: string
): {
  winningDirection: Direction;
  tieBreak: TieBreak;
  tiedDirections: Direction[];
  sensorDiversityByDirection: Record<Direction, number>;
} => {
  const sensorSets: Record<Direction, Set<Sensor>> = {
    north: new Set<Sensor>(),
    east: new Set<Sensor>(),
    south: new Set<Sensor>(),
    west: new Set<Sensor>(),
  };
  for (const vote of votes) sensorSets[vote.direction].add(vote.sensor);
  const sensorDiversityByDirection: Record<Direction, number> = {
    north: sensorSets.north.size,
    east: sensorSets.east.size,
    south: sensorSets.south.size,
    west: sensorSets.west.size,
  };
  const maximumVotes = Math.max(...AVAILABLE_DIRECTIONS.map((direction) => counts[direction]));
  const tiedDirections = AVAILABLE_DIRECTIONS.filter(
    (direction) => counts[direction] === maximumVotes
  );
  if (tiedDirections.length === 1) {
    return {
      winningDirection: firstDirection(tiedDirections),
      tieBreak: 'vote-count',
      tiedDirections,
      sensorDiversityByDirection,
    };
  }
  const maximumDiversity = Math.max(
    ...tiedDirections.map((direction) => sensorDiversityByDirection[direction])
  );
  const diversityFinalists = tiedDirections.filter(
    (direction) => sensorDiversityByDirection[direction] === maximumDiversity
  );
  if (diversityFinalists.length === 1) {
    return {
      winningDirection: firstDirection(diversityFinalists),
      tieBreak: 'sensor-diversity',
      tiedDirections,
      sensorDiversityByDirection,
    };
  }
  const scored = diversityFinalists
    .map((direction) => ({
      direction,
      score: createAuditHash(`${seed}|${direction}`),
    }))
    .sort((left, right) => left.score.localeCompare(right.score));
  return {
    winningDirection: firstDirection(scored.map(({ direction }) => direction)),
    tieBreak: 'deterministic-seed',
    tiedDirections,
    sensorDiversityByDirection,
  };
};

export const createRoundIdentity = (
  subredditId: string,
  postId: string
): RoundIdentity => ({
  installationKey: subredditId,
  postId,
  chapter: CURRENT_CHAPTER_NUMBER,
  day: CURRENT_DAY,
  schemaVersion: ROUND_SCHEMA_VERSION,
});

export class RoundService {
  private readonly redis: RoundRedis;
  private readonly identity: RoundIdentity;
  private readonly now: () => Date;
  private readonly sensorForUser: (userId: string) => Sensor;
  private readonly maxTransactionAttempts: number;

  constructor(options: RoundServiceOptions) {
    this.redis = options.redis;
    this.identity = options.identity;
    this.now = options.now ?? (() => new Date());
    this.sensorForUser = options.sensorForUser;
    this.maxTransactionAttempts = options.maxTransactionAttempts ?? 6;
  }

  async getState(
    userId: string | undefined,
    canResolve: boolean
  ): Promise<RoundStateResponse> {
    const keys = createRoundKeys(this.identity);
    const voterKey = userId ? createVoterKey(keys.prefix, userId) : null;
    const [metaRaw, votesRaw, resolutionRaw, voteRaw] = await Promise.all([
      this.redis.get(keys.meta),
      this.redis.hGetAll(keys.votes),
      this.redis.get(keys.resolution),
      voterKey ? this.redis.hGet(keys.votes, voterKey) : Promise.resolve(undefined),
    ]);
    const meta = parseMeta(metaRaw, this.identity);
    const votes = parseVoteCollection(Object.entries(votesRaw));
    const counts = countVotes(votes);
    const activeVote = parseStoredVote(voteRaw);
    const resolution = this.parseResolution(resolutionRaw);
    if ((meta.status === 'resolved') !== (resolution !== null)) {
      throw new RoundServiceError('storage-failure', 'Round status and resolution disagree');
    }
    return {
      schemaVersion: this.identity.schemaVersion,
      chapter: this.identity.chapter,
      day: this.identity.day,
      status: meta.status,
      counts,
      resolution,
      viewer: {
        authenticated: userId !== undefined,
        canVote: userId !== undefined && meta.status === 'open',
        canResolve: canResolve && meta.status === 'open',
        sensor: userId ? this.sensorForUser(userId) : 'echo',
        activeVote,
      },
    };
  }

  async submitVote(userId: string, request: SubmitVoteRequest): Promise<SubmitVoteResponse> {
    return await this.withWriteLease(() => this.submitVoteLocked(userId, request));
  }

  private async submitVoteLocked(
    userId: string,
    request: SubmitVoteRequest
  ): Promise<SubmitVoteResponse> {
    const keys = createRoundKeys(this.identity);
    const voterKey = createVoterKey(keys.prefix, userId);
    const requestKey = createIdempotencyKey(keys.prefix, voterKey, request.requestId);

    for (let attempt = 1; attempt <= this.maxTransactionAttempts; attempt += 1) {
      const transaction = await this.redis.watch(
        keys.meta,
        keys.votes,
        keys.idempotency,
        keys.resolution
      );
      try {
        const [metaRaw, existingRaw, votesRaw, requestRaw] = await Promise.all([
          this.redis.get(keys.meta),
          this.redis.hGet(keys.votes, voterKey),
          this.redis.hGetAll(keys.votes),
          this.redis.hGet(keys.idempotency, requestKey),
        ]);
        const meta = parseMeta(metaRaw, this.identity);
        if (meta.status !== 'open') {
          await transaction.unwatch();
          throw new RoundServiceError('round-resolved', 'This round no longer accepts votes');
        }
        const existing = parseStoredVote(existingRaw);
        const votes = parseVoteCollection(Object.entries(votesRaw));
        const counts = countVotes(votes);
        const priorRequest = parseIdempotency(requestRaw);
        if (priorRequest !== null) {
          await transaction.unwatch();
          if (priorRequest.direction !== request.direction) {
            throw new RoundServiceError(
              'idempotency-conflict',
              'This request ID was already used for another direction'
            );
          }
          if (existing === null) {
            throw new RoundServiceError(
              'storage-failure',
              'Idempotency record exists without an active vote'
            );
          }
          return {
            status: 'idempotent',
            activeVote: existing,
            counts,
            roundStatus: 'open',
          };
        }

        const timestamp = this.now().toISOString();
        const isDirectionChange = existing !== null && existing.direction !== request.direction;
        const isFirstVote = existing === null;
        const activeVote: ActiveVote =
          existing !== null && !isDirectionChange
            ? existing
            : {
                direction: request.direction,
                sensor: this.sensorForUser(userId),
                signalQuality: 1,
                revision: (existing?.revision ?? 0) + 1,
                createdAt: existing?.createdAt ?? timestamp,
                updatedAt: timestamp,
              };
        const nextCounts = { ...counts };
        if (isFirstVote) {
          nextCounts[request.direction] += 1;
          nextCounts.total += 1;
        } else if (isDirectionChange && existing !== null) {
          if (nextCounts[existing.direction] < 1) {
            await transaction.unwatch();
            throw new RoundServiceError(
              'storage-failure',
              'Previous direction count cannot be decremented safely'
            );
          }
          nextCounts[existing.direction] -= 1;
          nextCounts[request.direction] += 1;
        }

        await transaction.multi();
        await transaction.hSet(keys.votes, { [voterKey]: JSON.stringify(activeVote) });
        await transaction.hSet(keys.idempotency, {
          [requestKey]: JSON.stringify({
            direction: request.direction,
            revision: activeVote.revision,
          } satisfies IdempotencyRecord),
        });
        if (metaRaw === undefined) {
          await transaction.set(keys.meta, JSON.stringify(meta));
        }
        const expectedCommands = metaRaw === undefined ? 3 : 2;
        if (!(await executeTransaction(transaction, expectedCommands))) continue;
        return {
          status: isFirstVote || isDirectionChange ? 'recorded' : 'unchanged',
          activeVote,
          counts: nextCounts,
          roundStatus: 'open',
        };
      } catch (error) {
        if (isTransactionConflict(error) && attempt < this.maxTransactionAttempts) continue;
        throw error;
      }
    }
    throw new RoundServiceError(
      'round-unavailable',
      'The signal is crowded; retry the vote shortly'
    );
  }

  async resolve(): Promise<ResolveRoundResponse> {
    return await this.withWriteLease(() => this.resolveLocked());
  }

  private async resolveLocked(): Promise<ResolveRoundResponse> {
    const keys = createRoundKeys(this.identity);
    for (let attempt = 1; attempt <= this.maxTransactionAttempts; attempt += 1) {
      const transaction = await this.redis.watch(
        keys.meta,
        keys.votes,
        keys.resolution
      );
      try {
        const [metaRaw, votesRaw, resolutionRaw] = await Promise.all([
          this.redis.get(keys.meta),
          this.redis.hGetAll(keys.votes),
          this.redis.get(keys.resolution),
        ]);
        const meta = parseMeta(metaRaw, this.identity);
        const existingResolution = this.parseResolution(resolutionRaw);
        if (meta.status === 'resolved') {
          await transaction.unwatch();
          if (existingResolution === null) {
            throw new RoundServiceError(
              'storage-failure',
              'Resolved round is missing its immutable snapshot'
            );
          }
          return {
            status: 'resolved',
            alreadyResolved: true,
            resolution: existingResolution,
          };
        }
        if (meta.status !== 'open' || existingResolution !== null) {
          await transaction.unwatch();
          throw new RoundServiceError('round-unavailable', 'Round resolution is already in progress');
        }
        const voteEntries = Object.entries(votesRaw).sort(([left], [right]) =>
          left.localeCompare(right)
        );
        const activeVotes = parseVoteCollection(voteEntries);
        const storedCounts = countVotes(activeVotes);
        const resolvedAt = this.now().toISOString();
        const winner = chooseWinner(
          storedCounts,
          activeVotes,
          `${this.identity.postId}|${this.identity.chapter}|${this.identity.day}`
        );
        const auditInput = JSON.stringify({
          identity: this.identity,
          counts: storedCounts,
          votes: voteEntries.map(([voter, raw]) => ({ voter, vote: safeParseJson(raw, 'vote') })),
          winner,
          resolvedAt,
          resolutionVersion: ROUND_RESOLUTION_VERSION,
        });
        const resolution: RoundResolution = {
          status: 'resolved',
          winningDirection: winner.winningDirection,
          countsSnapshot: storedCounts,
          sensorDiversityByDirection: winner.sensorDiversityByDirection,
          tieBreak: winner.tieBreak,
          tiedDirections: winner.tiedDirections,
          resolvedAt,
          resolutionVersion: ROUND_RESOLUTION_VERSION,
          auditHash: createAuditHash(auditInput),
        };
        const resolvedMeta: RoundMeta = { ...meta, status: 'resolved' };
        await transaction.multi();
        await transaction.set(keys.resolution, JSON.stringify(resolution));
        await transaction.set(keys.meta, JSON.stringify(resolvedMeta));
        if (!(await executeTransaction(transaction, 2))) continue;
        return { status: 'resolved', alreadyResolved: false, resolution };
      } catch (error) {
        if (isTransactionConflict(error) && attempt < this.maxTransactionAttempts) continue;
        throw error;
      }
    }
    throw new RoundServiceError(
      'round-unavailable',
      'The round changed during resolution; retry shortly'
    );
  }

  private async withWriteLease<T>(operation: () => Promise<T>): Promise<T> {
    const { writeLease } = createRoundKeys(this.identity);
    const token = randomUUID();
    let acquired = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = await this.redis.set(writeLease, token, {
        nx: true,
        expiration: new Date(Date.now() + 15_000),
      });
      if (result === 'OK') {
        acquired = true;
        break;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, Math.min(8 + attempt * 2, 40));
      });
    }
    if (!acquired) {
      throw new RoundServiceError(
        'round-unavailable',
        'The signal is busy; retry shortly'
      );
    }
    try {
      return await operation();
    } finally {
      const currentToken = await this.redis.get(writeLease);
      if (currentToken === token) await this.redis.del(writeLease);
    }
  }

  private parseResolution(raw: string | undefined): RoundResolution | null {
    if (raw === undefined) return null;
    const value = safeParseJson(raw, 'round resolution');
    if (
      typeof value !== 'object' ||
      value === null ||
      !('status' in value) ||
      value.status !== 'resolved' ||
      !('winningDirection' in value) ||
      !isDirection(value.winningDirection) ||
      !('countsSnapshot' in value) ||
      !('sensorDiversityByDirection' in value) ||
      !('tiedDirections' in value)
    ) {
      throw new RoundServiceError('storage-failure', 'Stored round resolution is invalid');
    }
    const countsSnapshot = parseCommunityCounts(value.countsSnapshot);
    const diversity = parseSensorDiversity(value.sensorDiversityByDirection);
    const tiedDirections = value.tiedDirections;
    if (
      countsSnapshot === null ||
      diversity === null ||
      !('tieBreak' in value) ||
      (value.tieBreak !== 'vote-count' &&
        value.tieBreak !== 'sensor-diversity' &&
        value.tieBreak !== 'deterministic-seed') ||
      !Array.isArray(tiedDirections) ||
      !tiedDirections.every(isDirection) ||
      !('resolvedAt' in value) ||
      typeof value.resolvedAt !== 'string' ||
      Number.isNaN(Date.parse(value.resolvedAt)) ||
      !('resolutionVersion' in value) ||
      value.resolutionVersion !== ROUND_RESOLUTION_VERSION ||
      !('auditHash' in value) ||
      typeof value.auditHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(value.auditHash)
    ) {
      throw new RoundServiceError('storage-failure', 'Stored round resolution is invalid');
    }
    return {
      status: 'resolved',
      winningDirection: value.winningDirection,
      countsSnapshot,
      sensorDiversityByDirection: {
        north: diversity.north,
        east: diversity.east,
        south: diversity.south,
        west: diversity.west,
      },
      tieBreak: value.tieBreak,
      tiedDirections,
      resolvedAt: value.resolvedAt,
      resolutionVersion: value.resolutionVersion,
      auditHash: value.auditHash,
    };
  }
}
