# Judges: start here

MURMUR turns Reddit's most native behavior—many people comparing partial interpretations in a thread—into the core game mechanic. The hook is not a chat wrapper: each player will eventually perceive a different truth, while the subreddit receives only one consequential move.

## What is playable now

1. Open the Interactive Post and select **ENTER THE SIGNAL**.
2. In the expanded cavern, tap/click empty space up to three times.
3. Watch Echo briefly reveal cave edges, a hollow-looking route, and an abstract danger in conflicting directions.
4. Choose North, East, South, or West and explicitly confirm the signal.
5. See real Redis-backed aggregate counts and your active vote.
6. Change the active vote while the round is open or replay the sensory signal.
7. As a moderator, use the separate two-step resolve control to freeze the round.
8. Watch Murmur follow the immutable winning direction and inspect the final community result.

This slice proves the feel, readability, interaction model, Devvit client/server/Redis boundary, concurrent community voting, and manual outcome playback. It does not pretend that automatic daily cadence or private sensor assignment exists; those boundaries are explicit in [LIMITATIONS.md](LIMITATIONS.md).

## Technical map

- [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) — product thesis and exclusions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current and target systems
- [docs/DECISIONS.md](docs/DECISIONS.md) — consequential tradeoffs
- [docs/TESTING.md](docs/TESTING.md) — reproducible validation
- [docs/TRANSACTIONAL_VOTING.md](docs/TRANSACTIONAL_VOTING.md) — state model and invariants
- [evidence/README.md](evidence/README.md) — captured evidence index
