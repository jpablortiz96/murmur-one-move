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

## Known threats

- Public deterministic algorithms are studyable.
- A player can coordinate multiple Reddit accounts; abuse controls are future work.
- Client screenshots or self-reported observations can be shared, which is intended social play.
- Reddit/Devvit context availability is an external dependency.
