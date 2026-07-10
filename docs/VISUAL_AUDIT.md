# Visual audit — launch-quality pass

Date: 2026-07-10

## Scope and method

The audit covers the existing Echo vertical slice only. No persistence, daily resolution, private sensor assignment, Heat/Wind gameplay, or new product scene was introduced.

Every required viewport was rendered in Chrome 150 through the local Vite harness, which mounts the same Hono `/api/health` and `/api/bootstrap` routes used by the Devvit build. The script exercised intro, untouched Echo, an active first pulse, a persisted East decision, and Change Choice. The 360 × 800 run used synthesized touch for game interaction and mouse for the final action; the other sizes used mouse. Every stored image was visually inspected after capture.

The harness is not presented as Reddit persistence or community behavior. Reddit embedding is verified separately through Devvit playtest.

## Before → after

Before this pass, layout values were spread across the scene and cave, direction controls were rounded UI buttons, Echo was a single full ring that could be clipped, all routes were nearly symmetric, ambient motes were redrawn every frame, and the decision state displayed competing text levels. Baseline captures are preserved in [`evidence/visual/before`](../evidence/visual/before/).

After this pass:

- Header, World, and Action zones come from one deterministic layout function with safe-area insets.
- North/East/South/West are 82 × 62 resonant cave nodes with idle, hover, pressed, selected, disabled, and dimmed states.
- Paths have different bends, lengths, opening shapes, and visual confidence.
- Echo uses a near response, segmented environmental wave, progressive wall reveal, hollow secondary echoes, and a delayed hazard.
- Pulse 1 emphasizes structure; pulse 2 emphasizes the eastern hollow; pulse 3 exposes the western contradiction.
- Murmur breathes irregularly, moves its antennae, intensifies its core on Echo, contracts on danger, faces selection, reacts to touch, and calms after recording.
- `Signal recorded` is temporary (900 ms); the persistent hierarchy is `{DIRECTION} SIGNAL HELD`, one community sentence, and two actions.

## Required viewport matrix

| Viewport | Input exercised | Result | Evidence |
|---|---|---|---|
| 360 × 800 | Touch pulses/selection + mouse action | No overlap or scroll; CTA has 60 px lower clearance; South ends well above the World instruction; final actions remain fully visible. | [intro](../evidence/visual/360x800-intro.png), [Echo](../evidence/visual/360x800-echo.png), [pulse](../evidence/visual/360x800-pulse.png), [selected](../evidence/visual/360x800-selected.png), [changed](../evidence/visual/360x800-changed.png) |
| 390 × 844 | Mouse | No overlap or clipping; world receives additional vertical depth; decision actions retain a visible gap. | [intro](../evidence/visual/390x844-intro.png), [Echo](../evidence/visual/390x844-echo.png), [pulse](../evidence/visual/390x844-pulse.png), [selected](../evidence/visual/390x844-selected.png), [changed](../evidence/visual/390x844-changed.png) |
| 412 × 915 | Mouse | No overlap or clipping; South, instruction, counter, and decision copy occupy distinct bands. | [intro](../evidence/visual/412x915-intro.png), [Echo](../evidence/visual/412x915-echo.png), [pulse](../evidence/visual/412x915-pulse.png), [selected](../evidence/visual/412x915-selected.png), [changed](../evidence/visual/412x915-changed.png) |
| 768 × 1024 | Mouse | Spacious density keeps the world dominant without stretching mobile coordinates; actions remain centered and in bounds. | [intro](../evidence/visual/768x1024-intro.png), [Echo](../evidence/visual/768x1024-echo.png), [pulse](../evidence/visual/768x1024-pulse.png), [selected](../evidence/visual/768x1024-selected.png), [changed](../evidence/visual/768x1024-changed.png) |
| 1280 × 720 | Mouse | Dedicated wide composition uses a shallower header/action region and longer asymmetric lateral routes; no mobile-column stretching. | [intro](../evidence/visual/1280x720-intro.png), [Echo](../evidence/visual/1280x720-echo.png), [pulse](../evidence/visual/1280x720-pulse.png), [selected](../evidence/visual/1280x720-selected.png), [changed](../evidence/visual/1280x720-changed.png) |

For all five sizes, DOM viewport, document, client area, and canvas bounds matched exactly, producing zero internal scroll. Machine-readable results are in [matrix-results.json](../evidence/visual/matrix-results.json).

## Reduced motion and access

`prefers-reduced-motion: reduce` was emulated at 360 × 800 and reported `true` inside the page. Camera zoom, breathing loops, drifting motes, expanding waves, node resonance, and transition fades are replaced by static or short state changes. The visual Echo information remains available. Evidence: [360x800-reduced-motion.png](../evidence/visual/360x800-reduced-motion.png).

All interactive Phaser targets are at least 48 px high; directional nodes use an 82 × 62 hit area. Selection is identified by a diamond, additional outline, route geometry, label, and dimming—not color alone. Contrast was visually inspected over the darkest fog state.

Known access limitation: individual Phaser canvas controls do not yet expose semantic buttons to screen readers. Keyboard/screen-reader parity requires a future, carefully synchronized accessibility layer and remains documented in `LIMITATIONS.md`.

## Performance observations

- The previous per-frame `Graphics.clear()` + redraw of fog and 22 motes was removed.
- Sixteen bounded mote objects and one fog graphic are created once and animated by fixed-count repeating Phaser tweens; layout graphics redraw only on scene creation/resize/state changes.
- Each Echo creates four temporary display objects and destroys them on completion.
- Each node selection creates one temporary resonance object and destroys it after 320 ms.
- No shader, unbounded emitter, downloaded asset, or audio object was added.
- A 45-frame sample after the full interaction sequence measured 16.66–16.68 ms average (reported 60 fps) at every required headless viewport.

This is a controlled desktop/headless observation, not a substitute for profiling on modest physical phones or inside Reddit's iOS/Android apps.

## Reddit playtest verification

- App: `murmur-one-move`; test community: `r/murmur_one_move_dev`.
- Devvit published playtest version `v0.0.2.28` after the final client and server rebuilds.
- The playtest log recorded a live connection to the Interactive Post URL.
- On 2026-07-10, the human verifier opened the real Reddit post, activated `ENTER THE SIGNAL`, and confirmed that the experience reached the `ECHO` observation state.
- One earlier WebView asset upload hit a transient DNS `ENOTFOUND`; Devvit then published versions `.21`, `.24`, and `.28` successfully. The final stderr tail ended with `Success!` and no later runtime error.

Playtest URL: <https://www.reddit.com/r/murmur_one_move_dev/?playtest=murmur-one-move>

## Remaining visual debt

- Programmatic art remains provisional and needs human playtest feedback for emotional readability.
- Physical-device safe-area behavior is implemented through CSS `env()` values but was not exercised on a notched device in this run.
- No audio exists; all feedback is visual by design for this phase.
- The debug overlay intentionally prioritizes diagnostics and can cover header art at 360 px; it never appears in normal mode.
