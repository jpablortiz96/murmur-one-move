# Evidence index

This directory records reproducible evidence from the current implementation. Evidence must include dates, exact commands or viewport sizes, and concrete results; a generic “works” is not acceptable.

Expected entries for this phase:

- Automated validation summary (`type-check`, `lint`, `test`, `build`)
- Reddit playtest URL, app version, and test subreddit
- `/api/health` and `/api/bootstrap` response observations
- Gameplay sequence results through three pulses, selection, change, and replay
- Responsive viewport matrix and reduced-motion observation
- Client/server log review

Screenshots may be added only when they contain no credentials, private account data, or tokens. Generated bundles and local logs are not evidence artifacts and must remain untracked.

## 2026-07-10 visual pass

- `visual/before/` preserves the pre-polish baseline.
- `visual/{width}x{height}-{intro|echo|pulse|selected|changed}.png` contains the inspected five-state matrix.
- `visual/360x800-reduced-motion.png` records reduced-motion emulation with the opt-in diagnostic overlay.
- `visual/matrix-results.json` records exact viewport/document/client/canvas dimensions, input mode, and sampled frame pacing.
- The interpretation and per-viewport verdicts are in `docs/VISUAL_AUDIT.md`.

## 2026-07-13 transactional round pass

- `phase3/playtest-results.json` records the real app version, subreddit, post IDs, vote revisions, frozen results, audit hashes, and log review without voter identifiers.
- `phase3/360x800-local-safe-failure-normal.png` records the normal-mode 360 × 800 failure path when Devvit identity/Redis is intentionally unavailable locally: no scroll, no clipped actions, and explicit safe retry copy.
- `phase3/360x800-local-safe-failure.png` records the same state with the opt-in diagnostic overlay.
- The final Reddit gameplay run on `v0.0.2.37` committed EAST revision 1, changed the same active vote to WEST revision 2 while total remained 1, then resolved WEST manually with audit hash `sha256:0fa061884a0193e1f4ff89af1f6307a6ae13ed2b19770401e3c5ef3cb9cc5ae4`. The documentation/menu-copy rebuild installed as `v0.0.2.39` without changing gameplay code.
- The player visibly confirmed the resolved consequence (`MURMUR FOLLOWS WEST`). No server errors were found in the final stdout/stderr review.
