# Transactional community voting

## Scope

The implemented round is identified by installation, Reddit post, chapter, day, and schema version. The installation boundary is supplied by Devvit Redis; post and user identity come only from request context. Chapter 1/day 1 are currently supplied by bootstrap.

The perception layer is still Echo-only. The stored sensor field is part of the versioned vote schema, but it must not be interpreted as proof of private Echo/Heat/Wind assignment.

## State model

- Status: `open | resolving | resolved`
- Active vote: direction, sensor, signal quality, monotonic revision, creation/update timestamps
- Counts: North/East/South/West plus total, derived from the active-vote hash
- Resolution: winning direction, frozen counts, sensor diversity, tie-break reason, tied directions, timestamp, version, audit hash

Redis keys use a `murmur:v1:round` prefix and a hash of the post identity. Separate keys store metadata, active votes, handled request IDs, the immutable resolution, and a short write lease. Voter fields are SHA-256 hashes scoped to the post; usernames and raw user IDs are never stored.

## Vote transaction

1. Validate the client body and reject guests before state access.
2. Acquire a short `SET NX` write lease for the round.
3. Watch the round keys and read metadata, existing vote, request record, and active votes.
4. Return the prior response when the same request ID and payload are repeated.
5. Reject reuse of a request ID with a different payload.
6. Reject a resolved round.
7. Create or replace exactly one voter hash field, incrementing its revision.
8. Store the idempotency record and commit with `MULTI/EXEC`.
9. Recompute counts from the resulting active-vote set; never increment/decrement a client-visible counter independently.

Transactions retry a bounded number of times. Lease contention or Redis uncertainty is returned as a retryable service error; the server never claims an unconfirmed vote.

## Manual resolution

Only a moderator returned by the live Reddit API can reach resolution. Resolution uses the same serialized transaction boundary, recomputes all source votes, and writes one immutable object. Repeating resolution returns that object with `alreadyResolved: true`.

Tie-breaking order is:

1. Highest vote count.
2. Highest distinct-sensor count among the tied directions.
3. Deterministic SHA-256 seed over round identity and tied candidates.

The audit hash is SHA-256 over a canonical representation of the frozen result. It allows later equality checks without exposing voters.

## Enforced invariants

- At most one active vote per authenticated user and round.
- Same request ID plus same payload is idempotent.
- Same request ID plus different payload is rejected.
- A change preserves total active-voter cardinality.
- Counts cannot be negative because they are derived, not independently decremented.
- Aggregate total equals active-vote hash cardinality.
- A resolved round accepts no further votes.
- A second resolution cannot create a different result.
- No username, raw voter identifier, or voter map crosses the client boundary.

## Deliberate tradeoff

Devvit Redis exposes optimistic transactions, but the official in-memory test adapter does not reproduce every WATCH conflict pattern. The service therefore combines WATCH/MULTI/EXEC with a bounded per-round write lease and source-of-truth vote derivation. Concurrency tests exercise simultaneous first votes, same-user changes, and vote-versus-resolution races.
