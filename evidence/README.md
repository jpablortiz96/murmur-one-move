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
