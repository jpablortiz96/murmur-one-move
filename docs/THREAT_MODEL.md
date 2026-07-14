# Threat model

## Protected information

Complete scenario truth, unique optimal direction, survivability, consequence IDs, raw user IDs, voter keys, and other players' individual votes.

## Trust boundaries

- Untrusted: query parameters, headers, request bodies, local storage, Phaser state, and all client calculations.
- Trusted for this phase: Devvit request context, installation-scoped Redis, server world modules, and Reddit moderator lookup.

Vote bodies accept exactly `direction` and `requestId`; sensor/user identity fields are rejected. The server recomputes assignment for every vote. A vote change or retry therefore cannot change sensor identity, and resolution diversity uses stored server-derived senses.

## Leakage controls

- Hidden types never enter shared/client modules.
- Three independent projectors construct fresh objects.
- The session response self-validates.
- Tests recursively scan payload keys and domain crossing.
- Evidence scans client imports and generated client bundles.
- Full identity and hidden solution are absent from application logs.
- `MURMUR_LOCAL_SENSOR` exists only in Vite tooling; production has no query/header/body override.

## Field Notes (UGC)

- The Field Note draft accepts exactly `direction`, `confidence`, `observationId`, and optional
  `commentary`; identity, sensor, season, post and the allowed observation set are all server-derived.
  A cross-sensor observation is rejected server-side.
- Publication requires a signed, expiring preview token bound to the exact body; a tampered or expired
  token is rejected, and the token's voter/season/day/post must match the caller's live context.
- The app posts as the user only via `runAs: 'USER'` and only after verifying the returned author
  equals the caller; otherwise it degrades to the copy fallback and never claims a user posted.
- Stored metadata is minimal (no comment text, commentary or usernames); the voter hash is one-way.
  Client payloads never expose voter hashes, user ids, another sensor's domain, or the optimal route
  before the post-resolution reveal. The correct-minority reveal is metadata-only and never names,
  ranks or penalizes contributors.
- Commentary is length-capped and screened for control/format characters, repeated-character spam,
  multiple URLs and layout-breaking markup. Native reporting, moderators and deletion remain
  authoritative; there is no internal comment copy and no LLM moderation.

## Known threats

- Public deterministic algorithms are studyable.
- Field Note recovery is effectively-once; a lost response can orphan a real comment until retry.
- A player can coordinate multiple Reddit accounts; abuse controls are future work.
- Client screenshots or self-reported observations can be shared, which is intended social play.
- Reddit/Devvit context availability is an external dependency.
