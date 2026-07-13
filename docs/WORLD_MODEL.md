# World model

## Server-only truth

`src/server/game/world` owns the complete scenario. Every direction has three independent domains:

- Structure: continuity, stability, cavity, and perceived depth.
- Thermal: temperature, biological signature, motion, and volatility.
- Airflow: strength, direction, contamination, and turbulence.

It also owns survivability, internal consequence IDs, and the unique optimal direction. None of those types or values exists in `src/shared` or `src/client`.

## Deterministic identity

The generator hashes post ID from Devvit context, chapter, day, and generator version. Request order cannot affect it. The same identity produces byte-identical truth; changing post/day/version may change the role rotation.

Four path roles are rotated across directions: optimal, structurally attractive thermal decoy, ambiguous, and immediate danger. Validation requires all four directions, one survivable optimal path, at least two plausible paths per individual sense, and exactly one candidate in the intersection of all three server-only plausibility rules.

## Honest security boundary

Determinism is reproducibility, not cryptographic secrecy. Because the repository contains the generator, a developer could study its rules. A future phase may persist a server-only random seed in Redis, but this phase makes no secrecy claim beyond preventing truth from crossing the runtime payload boundary.
