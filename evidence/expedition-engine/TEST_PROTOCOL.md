# Seven-day expedition evidence protocol

Date: 2026-07-13. Run from the repository root with the committed dependency lockfile.

## Deterministic engine and scheduler evidence

```powershell
npm run evidence:expedition
```

This performs a production build, runs `tools/expeditionEvidence.test.ts`, simulates 10,000 complete seven-day journeys from fixed seeds, and renders plots from the emitted JSON. Re-running must reproduce the simulation SHA-256 hash.

Assertions include:

- exactly seven resolved days and one terminal ending per journey;
- no Day 8, invalid condition, impossible state or blocked run;
- safe/costly/dangerous consequences preserve vitality/memory/scar bounds;
- all legal transition edges and no illegal reopen;
- 100 concurrent resolve calls -> one snapshot;
- 100 concurrent publish calls -> one post;
- lost create response, expired lease and worker interruption recover without duplicate post;
- seven neutral titles, text fallbacks and `postData` <= 2 KB with no private fields.

## Visual matrix

```powershell
node tools/capture-expedition.mjs
```

The script starts the isolated Vite harness for each case, uses Chrome device metrics and captures 360×800, 390×844, 412×915, 768×1024 and 1280×720 plus reduced motion. Inspect every PNG for clipping, overlaps, contrast, world/UI hierarchy and visible non-color condition marks. Confirm `raw/visual-matrix.json` reports inner/document/canvas equality and `[0,0]` scroll.

The harness contains no Reddit identity and does not claim persistence or scheduler delivery.

## Real Reddit gate

1. Run `npm run dev -- murmur_one_move_dev` and record installed version and URL.
2. Open or recover Day 1 from the subreddit menu.
3. Complete the assigned sense, confirm a vote and verify total 1.
4. Close/resolve with the two-step moderator control.
5. Verify the combined three-truth reveal, direction, snapshot and consequence.
6. Publish next day and open the resulting Day 2 post.
7. Run reconcile once; verify no second Day 2 post appears.
8. Review client/server logs for errors and identity/World Truth leakage.

This final human gate is required before status PASS.
