# Testing MURMUR

## Automated checks

```powershell
npm install
npm run type-check
npm run lint
npm test
npm run build
```

The unit suite covers bootstrap validation, direction normalization, decision selection/change/reset, and feature-flag validation. The build verifies both configured HTML entrypoints and the CommonJS Devvit server bundle.

`tests/layout.test.ts` deterministically covers all five required viewports, zone adjacency, safe-area offsets, target bounds, South/instruction clearance, and wide-layout divergence.

## Manual gameplay script

1. Open the generated Reddit playtest URL and locate the MURMUR Interactive Post.
2. Confirm the inline view contains no starter artwork or scrollbars.
3. Select **ENTER THE SIGNAL** and confirm expanded mode loads.
4. Observe a visible loading state while `/api/bootstrap` resolves.
5. Tap/click empty cavern space three times; confirm exactly three waves and no fourth pulse.
6. Confirm Echo briefly exposes wall edges, a hollow cue, and a warm abstract danger cue.
7. Select each direction in turn using **CHANGE CHOICE**; confirm highlight and Murmur orientation are not color-only.
8. Select **REPLAY SIGNAL**; confirm the observation and pulse budget reset.
9. Append `?debug=1` to a supported game URL; confirm viewport/state information and reset/pulse controls appear only there.
10. Review playtest client/server logs for errors after the full sequence.

## Responsive matrix

Validate 360 × 800, 390 × 844, 412 × 915, 768 × 1024, and 1280 × 720. For every viewport record: no internal scroll, no clipped text, all actions within frame, ≥44 px targets, readable contrast, and stable cave composition. Repeat at 360 × 800 with reduced motion emulation.

## Failure-path checks

- Force `/api/bootstrap` to fail or intercept it in a local harness: error copy and **RETRY SIGNAL** must appear.
- Return malformed JSON: the same explicit invalid-response path must appear.
- Retry against a healthy server: only one playable scene should start.

Concrete run results belong in `evidence/README.md`; do not rewrite planned checks as completed evidence.

## Automated visual harness

```powershell
npm run dev:local:client
```

The local Vite-only configuration mounts the real Hono health/bootstrap router without Devvit context. Chrome CDP can then set exact device metrics, dispatch touch/mouse input, and capture PNGs. This is for client layout QA only; final embedding still requires `npm run dev` and the Reddit playtest URL.

The completed 2026-07-10 run captured intro, Echo, active pulse, selected, and changed states at 360 × 800, 390 × 844, 412 × 915, 768 × 1024, and 1280 × 720. See [VISUAL_AUDIT.md](VISUAL_AUDIT.md).
