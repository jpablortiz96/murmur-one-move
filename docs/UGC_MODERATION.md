# UGC moderation and privacy

Field Notes are user-generated content published as native Reddit comments. Reddit's own systems are
the primary moderation surface; the app adds lightweight input hygiene and strict data minimization.

## Native moderation is authoritative

Every Field Note remains subject to native Reddit reporting, subreddit moderators, native deletion,
and Reddit's content policies. The app does not copy full comments into an internal moderation queue
and does not moderate with an LLM. The composer states plainly:

> Your Field Note will be public and reportable on Reddit.

## Input hygiene (not a substitute for moderation)

`validateCommentary` (shared, applied authoritatively server-side) enforces:

- ≤160 characters after NFC normalization and whitespace collapse.
- No control or format characters (blocks zero-width / hidden payloads).
- No runs of a single character repeated 10+ times (basic spam).
- At most one URL.
- No layout-breaking markdown (link/image syntax, code fences, raw HTML tags).
- Non-empty only when present; empty/whitespace commentary is dropped.

The structured fields (direction, confidence, observation) are validated against fixed enums and the
caller's sensor. The observation is translated to body text from a server-only allow-list.

## Data minimization

- Comment bodies and commentary text are **never** stored in Redis.
- Usernames and raw user IDs are **never** stored. The index key is a one-way post-scoped voter
  hash, reused from the round vote identity.
- Stored per-note metadata is limited to: `commentId`, `parentCommentId`, `voterHash`, `sensor`,
  `direction`, `observationId`, `confidence`, `createdAt`, `status`, `schemaVersion`.
- The preview token is stateless and short-lived; it is not persisted.
- The idempotency marker stores only `{ commentId, commentUrl }` — no username; the author label on
  an idempotent replay is rebuilt from the requesting user's own context.

## Client-facing guarantees

No client payload (`/api/field-notes`, preview, publish) exposes a voter hash, user id, raw account
id, another sensor's domain, or the optimal route before the post-resolution reveal. The privacy
audit (`evidence/field-notes/raw/privacy-audit.json`) asserts zero leaks and zero stored text/usernames.

## Excerpt rendering (when shown)

If comment excerpts are ever displayed, they are fetched live from the Reddit API, not from a Redis
copy; deleted/unavailable comments are skipped; count and length are bounded; content is escaped and
never rendered as raw markdown inside the canvas. The minority reveal is computed from metadata, so
it works even when comment text cannot be loaded.
