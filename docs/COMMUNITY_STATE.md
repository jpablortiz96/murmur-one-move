# Community state

The community state is installation-scoped and round-scoped by hashed post identity, chapter, day, and schema version. The active-vote hash is the authoritative set. Counts are derived on reads and resolution, so total equals voter-field cardinality.

`GET /api/session` exposes anonymous counts, the caller's direction/revision, round status, and public resolution. It never exposes other callers' votes or identifiers.

Guests may obtain a demo perception but `canVote` is false and no Redis mutation occurs. Authenticated votes use a one-way post-scoped voter key. Moderator capability is checked with the live Reddit API and is not accepted from the client.
