# Input and mobile resolution test protocol

## Reproduce

```powershell
npm run type-check
npm run lint
npm test
npm run evidence:resolution
```

## Method: a real browser, not a DOM emulation

`tools/capture-resolution.mjs` reuses the existing Chrome headless + CDP harness
(`tools/capture-expedition.mjs` established it) driven by the local fixture server
`vite.local.config.ts` with `MURMUR_LOCAL_EXPEDITION_STATE=next-chapter-pending`, which yields a
resolved session with a combined truth and `canManage: true`.

No DOM emulator is used. jsdom cannot validate layout, z-index, viewport size or pointer
hit-testing, which is exactly what these defects were about. Instead:

- `Emulation.setDeviceMetricsOverride` sets each real viewport.
- `Emulation.setEmulatedMedia` applies `prefers-reduced-motion: reduce`.
- **`Input.dispatchMouseEvent` dispatches real mouse presses at each control's reported centre.**
  A stage only advances if its button was genuinely hittable, so input is proven, not inferred.
- `Runtime.evaluate` reads `window.__murmurPresentation`, a read-only diagnostic carrying only
  stage names, layer visibility and button rects — never World Truth, identity or the route.

## What is asserted per case

- **Exclusivity:** exactly one of `summary | threeTruths | consequence | expeditionMap | nextAction`
  is active. Three Truths, the consequence and the map can never share the zone.
- **No internal scroll:** `document.scrollWidth/Height` equal the viewport.
- **Hit-testing:** clicking the stage CTA actually changes the stage; a click that fails to advance
  is recorded as a failure.
- **Moderator tray:** closed by default in the terminal stage (`modResolve`/`modAux` not visible),
  and opens only when MOD TOOLS is clicked.
- **REPLAY OUTCOME:** restarts the sequence at `summary`, which also captures the summary stage
  deterministically before its auto-advance beat.

## Coverage

Viewports 360×800, 390×844, 412×915, 768×1024, 1280×720, plus 360×800 with reduced motion. Each
walks summary → three-truths → consequence → expedition-map → next-action, then the tray
closed/open, then replay.

Results in `RESULTS.md`; raw data in `raw/resolution-matrix.json`; screenshots in `screenshots/`.
