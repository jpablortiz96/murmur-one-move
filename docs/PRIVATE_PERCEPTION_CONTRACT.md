# Private perception contract

## Assignment

`assignSensor` hashes server-derived user ID, post ID, chapter, day, and assignment version. The client cannot submit or override any component. Usernames are neither required nor stored. Guests receive a clearly marked Echo demonstration with `stableAssignment: false` and cannot vote.

## Projection

Each projector builds a new object from scratch:

- Echo receives `structuralSignals` only.
- Heat receives `thermalSignals` only.
- Wind receives `airflowSignals` only.

Each contains three accessible activation descriptions derived only from that domain. No spread of hidden source objects is allowed.

The client never receives complete truth, optimal/correct direction, survivability, consequence IDs, generator input, user ID, usernames, voter hashes, individual votes, or another sensor domain.

## `GET /api/session`

The endpoint combines static expedition identity, authentication/stable-assignment state, one perception union, the caller's current vote, anonymous counts, moderator capability, public resolution, and feature flags. It validates the complete response with `parsePlayerSession` before sending.

`GET /api/bootstrap` remains static product metadata. `/api/round/vote` and `/api/round/resolve` remain commands. There is no competing community read endpoint.
