# Engineering and design decisions

## 2026-07-10 — Keep the official two-entrypoint Phaser starter

- **Decision:** Preserve the Devvit Web inline `splash.html` and expanded `game.html` pattern, replacing their content rather than removing the structure.
- **Rejected:** A single heavy inline Phaser bundle; a React shell around Phaser.
- **Why:** The starter intentionally keeps the feed entry fast and loads Phaser only after expanded mode is requested.
- **Consequence:** The visual transition crosses Reddit's inline/expanded boundary; the expanded scene completes the camera approach into Echo.

## 2026-07-10 — Generate all visible art at runtime

- **Decision:** Use Phaser Graphics, generated textures, particles, and CSS shapes only.
- **Rejected:** Stock cave packs, generated bitmap art, external fonts, copied character silhouettes.
- **Why:** This guarantees provenance, keeps the bundle self-contained, and makes the art responsive.
- **Consequence:** Art direction is coherent and original but remains provisional until dedicated art production.

## 2026-07-10 — Treat bootstrap JSON as untrusted

- **Decision:** Share TypeScript types and perform runtime validation before entering the playable scene.
- **Rejected:** Type assertion on `response.json()`; fallback to invented local server values.
- **Why:** TypeScript cannot validate network data and a fake fallback would hide Devvit failures.
- **Consequence:** Loading, transport, HTTP, parse, and invalid-contract failures converge on an explicit retry screen.

## 2026-07-10 — Keep decision state pure and local

- **Decision:** Model direction selection with a small tested pure reducer while making no persistence calls.
- **Rejected:** Early Redis voting; `localStorage` presented as a community vote.
- **Why:** The phase prohibits persistence and daily logic but needs reliable change/replay behavior.
- **Consequence:** Refreshing the webview resets the selection, documented as a limitation.

## 2026-07-10 — No autoplay audio

- **Decision:** Ship Echo as a fully visual signal in this phase.
- **Rejected:** Synthetic WebAudio on first load; hidden audio dependency.
- **Why:** Browser policies, accessibility, and the brief all favor a non-blocking visual baseline.
- **Consequence:** Sound design remains future work and the game never stalls behind an audio permission.

