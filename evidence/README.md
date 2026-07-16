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

## 2026-07-13 private-sense pass

- `private-senses/raw/` contains generated assignment, scenario, complementarity, leakage, Redis integration, endpoint, normal visual matrix, and reduced-motion results.
- `private-senses/plots/` contains four PNG plots rendered from those JSON files.
- `private-senses/screenshots/` contains Echo, Heat, and Wind at 360×800, 390×844, and 1280×720, plus reduced-motion 360×800 captures.
- `private-senses/TEST_PROTOCOL.md` is the reproduction procedure; `private-senses/RESULTS.md` records concrete verdicts and known scope.
- `phase3/` and the previously resolved WEST post remain untouched.

## 2026-07-13 seven-day expedition pass

- `expedition-engine/raw/` contains 10,000 seeded complete journeys, state transitions, scheduler idempotency, 100-worker duplicate delivery, seven chapter-post audits and reconciliation outcomes.
- `expedition-engine/plots/` contains ending, vitality, consequence, scheduler and completion plots generated from the raw JSON.
- `expedition-engine/screenshots/` contains the seven-node map, resolving state, three-truth reveal, consequence, next-day controls and completed ending at required mobile/desktop sizes.
- `expedition-engine/raw/visual-matrix.json` records exact viewport/document/canvas sizes, zero scroll and reduced-motion coverage.
- Reproduction and concrete results are in `expedition-engine/TEST_PROTOCOL.md` and `expedition-engine/RESULTS.md`.
- All earlier `phase3/` and `private-senses/` evidence remains preserved.
- Real Reddit gate: `murmur-one-move v0.0.2.49` reached Day 2 in `r/murmur_one_move_dev`; the moderator confirmed retained condition/history and no duplicate after reconciliation. See `expedition-engine/raw/reddit-playtest.json` for the exact evidence boundary.

## 2026-07-14 Field Notes pass

- `field-notes/raw/` records 10,000 previews (0 body-hash mismatches, all tampered and cross-sensor
  drafts rejected), 5,000 native publications with 0 duplicates, 2,000 notes through the deletion
  lifecycle, 10,000 minority-reveal resolutions and a privacy audit with 0 leaks.
- `field-notes/raw/reddit-playtest.json` records the honest boundary: native `runAs: 'USER'`
  authorship is **pending human verification** and the server default stays `fallback`.

## 2026-07-15 input, mobile resolution, navigation and guidance passes

- `input-mobile-hotfix/` — real Chrome headless + CDP with `Input.dispatchMouseEvent`: 42 cases,
  0 failures across five viewports plus reduced motion. Exactly one resolution stage owns the screen
  at a time, no internal scroll, moderator tray closed by default, REPLAY OUTCOME restarts the
  sequence. No DOM emulator is used; jsdom cannot validate layout, z-index or hit-testing.
- `fallback-navigation-guidance/` — 11 navigation and 18 guidance cases, 0 failures. OPEN COMMENTS
  invokes Devvit client navigation exactly once with the canonical `t3_`-stripped comments URL and a
  44×44 target; a forced bad destination shows the copy/retry recovery; the sense instruction is
  still present ~5.6 s after load with zero interactions on every viewport.
- Boundary: `navigateTo` is fire-and-forget, so these packs prove the handler and the URL, **not**
  that Reddit opened the comments. That remains the human test.
