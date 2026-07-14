# Redis schema

Round prefix:

```text
murmur:v{schema}:round:{sha256(postId)[0..24]}:c{chapter}:d{day}
```

Keys:

- `:meta` — versioned identity and `open|resolving|resolved` status.
- `:votes` — hash from post-scoped SHA-256 voter field to `ActiveVote`.
- `:requests` — hashed idempotency records.
- `:resolution` — one immutable resolution JSON value.
- `:write-lease` — short expiring cross-process serialization token.

`ActiveVote.sensor` is always obtained from `assignSensor` server-side. Votes from Phase 3 retain their historical data; this phase does not delete or rewrite any existing round. New private-sense playtests use a new Reddit post and therefore a different hashed namespace.

## Expedition V2

```text
murmur:v2:{sha256(subredditId)[0..24]}:season:{sha256(seasonId)[0..24]}
```

- `:state` — validated full expedition, public history and transition audit.
- `:post:{day}` — canonical chapter post ID.
- `:intent:publish:{day}` — durable creation intent used during lost-response recovery.
- `:scheduled:{day}:{task}` — successful scheduler marker.
- `:transition:{day}:{action}` — completed transition evidence.
- `:job:{hash(jobId)}` — task metadata without exposing raw state.
- `:lease:{state|resolve:day|publish:day}` — bounded cross-worker leases.

The installation-level `murmur:v2:{installation}:active-season` points to the active season. Usernames, World Truth and raw voter IDs are never stored in expedition keys.

## Field Notes V1

```text
murmur:v2:fn:{sha256(subredditId)[0..24]}:season:{sha256(seasonId)[0..24]}:d{day}
```

- `:notes` — hash from post-scoped voter hash to minimal `FieldNoteIndex` (`commentId`,
  `parentCommentId`, `voterHash`, `sensor`, `direction`, `observationId`, `confidence`, `createdAt`,
  `status`, `schemaVersion`). No comment text.
- `:parent` — the app-authored chapter parent comment id.
- `:lease:parent` and `:lease:publish:{voterHash}` — bounded creation/publish serialization.
- `:req:{voterHash}:{hash(requestId)}` — minimal idempotency marker `{commentId, commentUrl}` (no username).

Installation-scoped keys:

- `murmur:v2:fn:{installation}:secret` — installation HMAC secret for stateless preview tokens (never exposed).
- `murmur:v2:fn:{installation}:comment:{sha256(commentId)}` — reverse `comment → {season, day, voterHash}`
  index used by deletion triggers.

Comment bodies, commentary text, usernames and raw user IDs are never stored. The voter hash reuses
the round vote identity (`createVoterKey`), so a note is one-way linked to a voter without an account id.
