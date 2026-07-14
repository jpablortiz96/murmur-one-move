# Field Notes test protocol

## Reproduce

```powershell
npm run type-check
npm run lint
npm test
npm run build
npm run evidence:field-notes
```

`npm run evidence:field-notes` runs `tools/fieldNotesEvidence.test.ts` and renders three plots.
The simulation drives the real modules — `FieldNoteService`, `FieldNoteRepository`,
`previewToken`, `noteBody`, `observations`, `minority` — against a deterministic in-memory Redis
and a deterministic comment gateway. It is a scale/distribution and invariant harness, not human
usage; unit correctness is proven separately in `tests/fieldNote*.test.ts` and
`tests/minorityReveal.test.ts` on the real Devvit Redis test adapter.

## What each raw file records

- `preview-integrity.json` — 10,000 previews: every token re-publishes the exact previewed body
  (`bodyHashMismatches` = 0), every tampered token is rejected, every cross-sensor observation is
  rejected at preview.
- `publication-idempotency.json` — 5,000 native publications, 1,000 same-request-id resubmits, and
  500 concurrent request-id pairs per user; asserts no duplicate comments and no conflicts.
- `parent-comment-results.json` — one app parent comment per chapter regardless of how many notes
  reply; no duplicate parents under concurrency.
- `deletion-results.json` — 1,000 deletions desindex; 1,000 duplicate/out-of-order delete events
  are safe no-ops; 500 unindexed-comment deletes are rejected; 0 orphan indices.
- `minority-reveal.json` — 10,000 resolutions over varied note distributions; every verdict bucket
  occurs; reproducible; 0 identity fields exposed.
- `privacy-audit.json` — 0 client-payload leaks (no voterHash/userId/raw id/optimal route) and 0
  stored comment text or usernames; lists the minimal metadata actually persisted.
- `reddit-playtest.json` — the honest native User Actions boundary: authorship is pending a real
  authorized playtest; the server default stays `fallback`.

## Human playtest (separate, required for native mode)

The native `runAs: 'USER'` authorship and the client visual matrix (composer, preview, signal
board, minority reveal at five viewports + reduced motion) require running the app on
`r/murmur_one_move_dev`; see `RESULTS.md` for the exact human step. Screenshots belong in
`evidence/field-notes/screenshots/` once captured.
