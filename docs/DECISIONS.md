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

## 2026-07-10 — Centralize responsive composition into three invisible zones

- **Decision:** Derive Header, World, Action, path nodes, text baselines, and action positions from a pure `calculateLayout` function using viewport, aspect ratio, safe insets, orientation, and density.
- **Rejected:** Independent percentages inside the scene and cave; visible panels; one stretched mobile composition for landscape.
- **Why:** The old values allowed South, instruction, pulse count, and decision feedback to compete and could not be tested without rendering.
- **Consequence:** Five required viewports now have deterministic geometry tests; all future placement changes must flow through the layout contract.

## 2026-07-10 — Make Echo informational by pulse rather than louder by repetition

- **Decision:** Pulse 1 reveals structure, pulse 2 reinforces the eastern hollow, and pulse 3 reveals the western contradiction through separate bounded layers.
- **Rejected:** A larger full-screen ring on every tap; shaders; more particles.
- **Why:** Distinct information makes three taps meaningful while a segmented environmental wave avoids the appearance of a circle pasted over the UI.
- **Consequence:** The demonstration remains local and shared by all players; it still does not claim real private perception.

## 2026-07-10 — Reserve persistent decision UI for one hierarchy

- **Decision:** Show `Signal recorded` for 900 ms, then retain only `{DIRECTION} SIGNAL HELD`, the pending-community sentence, and Replay/Change actions.
- **Rejected:** Simultaneous path-held instruction, signal-recorded headline, pending copy, pulse counter, and actions.
- **Why:** A single persistent state is faster to parse on 360 px screens.
- **Consequence:** Direction controls dim but stay spatially present, while World instruction and pulse count leave the stage during the decision state.

## 2026-07-13 — Make active votes the only aggregate source of truth

- **Decision:** Store one hashed voter field per round and derive all directional counts from those active votes.
- **Rejected:** Independently incrementing/decrementing four counters; trusting totals sent by the client.
- **Why:** Derived counts structurally prevent negative values and count/cardinality drift during changes and retries.
- **Consequence:** Reads are linear in the active-vote set for this slice; future scale work must preserve the same invariant if counts are materialized.

## 2026-07-13 — Combine optimistic Redis transactions with a round write lease

- **Decision:** Use a short `SET NX` lease plus WATCH/MULTI/EXEC and bounded retry for every vote or resolution write.
- **Rejected:** Process-local locks; unbounded retry; Redis syntax from legacy Devvit Blocks.
- **Why:** Devvit instances may run concurrently, and resolution must serialize against vote changes across processes.
- **Consequence:** Brief contention becomes an explicit retryable response; stale leases expire automatically.

## 2026-07-13 — Hash voter fields and keep authorization server-side

- **Decision:** Derive identity from Devvit context, store a post-scoped SHA-256 voter field, and authorize resolution using the live Reddit moderator list.
- **Rejected:** Client-provided user IDs; usernames; a client boolean claiming moderator status.
- **Why:** The client is untrusted and aggregate gameplay does not require public identity.
- **Consequence:** Guests may observe but cannot vote, and local harnesses cannot simulate authenticated moderation.

## 2026-07-13 — Resolve with a deterministic, immutable snapshot

- **Decision:** Freeze counts, sensor diversity, tie-break evidence, timestamp, version, and canonical SHA-256 audit hash in one resolution object.
- **Rejected:** Recalculating a winner on every read; random tie-breaks; reopening a resolved round.
- **Why:** A shared daily consequence must be repeatable and auditable under retries.
- **Consequence:** Repeated resolve calls return the same object and all later vote attempts fail closed.

## 2026-07-13 — Separate moderator resolution from player actions

- **Decision:** Give resolution its own `MOD · RESOLVE` control with a timed second confirmation.
- **Rejected:** Replacing the primary Replay action with Resolve as soon as a moderator votes.
- **Why:** The first real playtest showed that a moderator could unintentionally end the round while trying to change a vote.
- **Consequence:** Replay and Change Vote stay stable; resolution is visibly privileged and deliberate.

## 2026-07-13 — Keep complete cavern truth in server modules only

- **Decision:** Define path structure, thermal state, airflow, survivability, consequence IDs, and the optimal direction only under `src/server/game/world`.
- **Rejected:** A shared scenario interface with hidden fields removed at serialization time.
- **Why:** A shared type or client import would make accidental leakage easier and weaken reviewability.
- **Consequence:** Projectors must construct fresh shared contracts and server tests own complementarity rules.

## 2026-07-13 — Assign senses by versioned context hash

- **Decision:** SHA-256 the server-derived user, post, chapter, day, and assignment version, then map uniformly to three senses.
- **Rejected:** Client choice, query override, usernames, mutable random assignment, or a stored assignment record.
- **Why:** The result is stable, balanced, stateless, and cannot be forced through request input.
- **Consequence:** The algorithm is deterministic rather than cryptographically secret; future secret seeding may be warranted.

## 2026-07-13 — Make `/api/session` the sole player read model

- **Decision:** Keep bootstrap static, move assignment/perception/community reads into one validated session payload, and retain round routes only for writes.
- **Rejected:** Independently fetching bootstrap, assignment, perception, and community state from overlapping endpoints.
- **Why:** One server-validated response prevents drift between sense, vote, and round status.
- **Consequence:** Reload restores both the stable sense and current vote through the same request.

## 2026-07-13 — Separate sensor controllers behind one small interface

- **Decision:** Share layout/selection/voting while isolating Echo tap, Heat hold, and Wind drag listeners and renderers.
- **Rejected:** A growing chain of sensor conditionals inside `MurmurScene`.
- **Why:** Distinct gestures require distinct lifecycle cleanup and reduced-motion behavior.
- **Consequence:** Every controller owns and destroys its listeners/graphics; new senses require a factory entry and contract.

## 2026-07-13 — Require node press origin before selection

- **Decision:** A direction node activates only when its own pointerdown preceded pointerup.
- **Rejected:** Accepting any pointerup over a node.
- **Why:** Visual QA showed Wind drags could otherwise select a path accidentally when a tracer ended over a node.
- **Consequence:** Observation gestures and deliberate decisions remain separate.
