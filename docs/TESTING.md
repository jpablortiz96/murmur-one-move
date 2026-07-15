# Testing MURMUR

## Automated checks

```powershell
npm install
npm run type-check
npm run lint
npm test
npm run build
```

The unit suite additionally covers deterministic scenarios, invalid-scenario rejection, 1,000-scenario complementarity, 30,000 balanced assignments, domain-isolated projectors, session unions/guest constraints, trusted Redis sensors, and three-activation progress caps.

It also covers the V2 transition graph, seven chapter definitions, deterministic branch hashes, consequence bounds, all endings, 100 concurrent repository updates, 100 concurrent resolutions and publications, successful scheduling deduplication, lost post-response recovery, a complete Day 1–7 coordinator run and the Day 8 prohibition.

It also covers Field Notes: draft/commentary/token/board/minority contracts, exact comment body,
per-sensor observations and cross-sensor rejection, preview integrity, native publication with one
attributed comment, idempotent double-submit, concurrent single-comment, guest/vote/round guards,
the honest fallback, unexpected-author fallback, the deletion lifecycle (delete, duplicate/out-of-order
no-ops, purge, re-share), and the correct-minority reveal cases.

`tests/layout.test.ts` deterministically covers all five required viewports, zone adjacency, safe-area offsets, target bounds, South/instruction clearance, and wide-layout divergence.

## Manual gameplay script

1. Open the generated Reddit playtest URL and locate the MURMUR Interactive Post.
2. Confirm the inline view contains no starter artwork or scrollbars.
3. Select **ENTER THE SIGNAL** and confirm expanded mode loads.
4. Observe a visible loading state while `/api/bootstrap` resolves.
5. Tap/click empty cavern space three times; confirm exactly three waves and no fourth pulse.
6. Confirm Echo briefly exposes wall edges, a hollow cue, and a warm abstract danger cue.
7. Choose a direction and press **CONFIRM SIGNAL**; confirm the server returns one active vote and aggregate total 1.
8. Use **CHANGE VOTE**, choose another direction, and confirm the revision increases while aggregate total remains 1.
9. Select **REPLAY SIGNAL**; confirm observation resets without deleting the active community vote.
10. As a moderator, press **MOD · RESOLVE** and then **CONFIRM RESOLVE**; confirm the separate control prevents accidental resolution.
11. Confirm Murmur follows the winner, frozen counts remain visible, and further votes are unavailable.
12. Append `?debug=1` to a supported game URL; confirm viewport/state information and reset/pulse controls appear only there.
13. Review playtest client/server logs for errors after the full sequence.

## Responsive matrix

Validate 360 × 800, 390 × 844, 412 × 915, 768 × 1024, and 1280 × 720. For every viewport record: no internal scroll, no clipped text, all actions within frame, ≥44 px targets, readable contrast, and stable cave composition. Repeat at 360 × 800 with reduced motion emulation.

## Failure-path checks

- Force `/api/bootstrap` to fail or intercept it in a local harness: error copy and **RETRY SIGNAL** must appear.
- Return malformed JSON: the same explicit invalid-response path must appear.
- Retry against a healthy server: only one playable scene should start.
- Open the local harness without Devvit context: community-round calls must return explicit 503 responses and the client must show safe retry copy.
- Submit a vote without `context.userId`: the API must return 401 and must not mutate Redis.
- Reuse a request ID with another direction: the API must return a conflict instead of silently replacing history.
- Vote after resolution: the API must return the existing resolved state and refuse mutation.

Concrete run results belong in `evidence/README.md`; do not rewrite planned checks as completed evidence.

## Automated visual harness

```powershell
npm run dev:local:client
```

The local Vite-only configuration mounts the health/bootstrap router without Devvit context. Chrome CDP can then set exact device metrics, dispatch touch/mouse input, and capture PNGs. Community APIs deliberately fail with 503 in this harness. This is for client layout and failure-path QA only; final persistence verification requires `npm run dev` and the Reddit playtest URL.

The completed 2026-07-10 run captured intro, Echo, active pulse, selected, and changed states at 360 × 800, 390 × 844, 412 × 915, 768 × 1024, and 1280 × 720. See [VISUAL_AUDIT.md](VISUAL_AUDIT.md).

For private-sense evidence:

```powershell
npm run evidence:private
node tools/capture-private-senses.mjs
node tools/capture-private-senses.mjs --reduced
```

The first command regenerates audits and plots from real deterministic runs. The capture script starts the isolated Vite harness once per sense, uses touch below 768 px and mouse otherwise, attempts four activations to prove the cap remains three, confirms an EAST fixture vote, and records exact canvas/document dimensions. It never changes production assignment behavior.

## Expedition evidence

```powershell
npm run evidence:expedition
node tools/capture-expedition.mjs
```

The first command builds, runs 10,000 seeded seven-day expeditions and writes raw transition/scheduler/post/recovery/distribution JSON plus five plots. The second opens the isolated production Phaser client in headless Chrome at 360×800, 390×844, 412×915, 768×1024 and 1280×720, including reduced motion. It records viewport/document/canvas dimensions and scroll position. See [../evidence/expedition-engine/TEST_PROTOCOL.md](../evidence/expedition-engine/TEST_PROTOCOL.md).

The final Reddit verification executed Day 1 sense -> vote -> moderator resolve -> combined reveal -> publish Day 2 -> reconcile. The authenticated moderator confirmed exactly one Day 2 post with condition and history retained on `v0.0.2.49`.

## Field Notes evidence

```powershell
npm run evidence:field-notes
```

Runs 10,000 previews, 5,000 native publications, 1,000 double-submits, 500 concurrent pairs, 2,000
notes with 1,000 deletions + 1,000 duplicate delete events + 500 unindexed deletes, 10,000
minority-reveal resolutions, and a privacy audit; then renders three plots. Results and the honest
native User Actions boundary live in [../evidence/field-notes](../evidence/field-notes). The native
`runAs: 'USER'` authorship and the Field Notes client visual matrix require a separate authorized
real-Reddit playtest and are recorded as pending, not inferred.

### Manual Field Notes script — fallback (default mode)

Fallback performs no Reddit write, so this script must **not** assert persistence, non-duplication,
board counting, the reveal, or delete-desindexing. Verify only:

1. After voting, **SHARE WHAT YOU SENSED** appears; it is absent before voting.
2. The preview shows the exact body; the composer never offers "POST AS u/…" in fallback.
3. **COPY FIELD NOTE** copies exactly the previewed text.
4. **OPEN COMMENTS** opens the chapter post's comments (not a Field Notes thread).
5. Paste and publish it yourself; the visible author is you and the body matches the preview.
6. The app says "copied", never "published" or "shared", and never claims the note is tracked.
7. No comment is created automatically and no app-account comment appears anywhere.

### Manual Field Notes script — native (only when authorized)

Only with User Actions authorized and `FIELD_NOTES_CONFIG.publishMode = 'native'`:

1. Preview shows the exact body; **POST AS u/{username}** is a separate, deliberate action.
2. Exactly one comment is created, replying to the chapter's Field Notes parent thread.
3. Reddit reports **you** as the real author (a mismatch must fall back and not claim you posted).
4. Reload: the note is still indexed and the composer no longer offers a second note.
5. Retrying does not create a duplicate.
6. The Signal Board counts it (breakdowns appear only at three or more notes).
7. After resolution the correct-minority reveal can use its metadata.
8. Deleting the comment on Reddit desindexes it: it stops counting on the board and in the reveal,
   and you may share a new note.
