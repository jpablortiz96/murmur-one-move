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
