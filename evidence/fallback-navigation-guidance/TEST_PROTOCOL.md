# Fallback navigation and sensor guidance test protocol

## Reproduce

```powershell
npm run type-check
npm run lint
npm test
npm run evidence:guidance
```

## Method: a real browser, no DOM emulator

`tools/capture-guidance.mjs` reuses the existing Chrome headless + CDP harness with the local
fixture server `vite.local.config.ts`. jsdom is not used and is not suitable: these defects were
blocked webview navigation, real pointer hit-testing and layout.

- `Emulation.setDeviceMetricsOverride` / `setEmulatedMedia` set each viewport and reduced motion.
- `Input.dispatchMouseEvent` drives every interaction as a real mouse event.
- Heat is a **press-and-hold**, so the harness holds ~520 ms. Heat also ignores a gesture that
  starts over an interactive object (Murmur is interactive at the world centre), so the hold lands
  on empty cavern.
- `HOW TO SENSE` is a Phaser control, not a DOM button; it is clicked at the centre reported by the
  read-only `window.__murmurGuidance` diagnostic.
- The composer dialog scrolls internally, so DOM controls are scrolled into view before clicking.
- `MURMUR_LOCAL_BAD_COMMENTS_URL=1` makes the fixture return an unparseable destination, which is
  the only failure `navigateTo` can surface, so the error path is captured deterministically.

## What is asserted

**Navigation**
- The preview body is exactly `HEAT FIELD NOTE · SOUTH … Medium confidence`.
- `OPEN COMMENTS` invokes the navigation abstraction exactly once per explicit click.
- The destination is the canonical comments URL of the post being read, with `t3_` stripped.
- The target is at least 44×44.
- A broken destination shows `COULDN'T OPEN COMMENTS`, offers `COPY COMMENTS LINK` (which copies the
  destination) and `TRY AGAIN` (which clears the error).
- The fallback never claims publication.
- No internal scroll at any viewport.

**Guidance**
- The full instruction is still present ~5.6 s after load with zero interactions — far beyond the
  old 1.8 s timer that removed it.
- The first activation compacts it to `Hold to focus · 1 of 3` without removing it.
- `HOW TO SENSE` restores the help; closing it returns to the compact line.

## Boundary

The harness proves the handler invokes Devvit's client navigation and that the URL is correct. It
cannot prove Reddit itself honours the effect — `navigateTo` is fire-and-forget. **Real navigation
inside the Interactive Post remains the human test.**
