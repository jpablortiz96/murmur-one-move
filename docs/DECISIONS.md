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

## 2026-07-13 — Compose the expedition over immutable round snapshots

- **Decision:** Keep the proven per-post vote service and let V2 consume its frozen resolution into a separate seven-day state machine.
- **Rejected:** One monolithic Redis object containing mutable votes, World Truth and journey state.
- **Why:** The vote boundary already guarantees identity, atomic changes and auditability; composition preserves old posts and narrows failure recovery.
- **Consequence:** V1 posts remain compatible while V2 adds season/day/branch identity and persistent consequences.

## 2026-07-13 — Design scheduler operations for at-least-once delivery

- **Decision:** Use immutable history/post identities, bounded leases, scheduling markers, stale-day checks and reconciliation.
- **Rejected:** Assuming exactly-once task delivery; process-local locks; deleting state to retry.
- **Why:** Workers and network responses can fail between an external effect and its Redis acknowledgment.
- **Consequence:** Duplicate tasks may execute but converge on one resolution and one chapter post; recovery is auditable, not silent.

## 2026-07-13 — Branch only from public immutable history

- **Decision:** Derive each scenario identity from season, day, generator version and the prior history hash.
- **Rejected:** Client-carried branch tokens; random world state stored in `postData`; future map pre-generation.
- **Why:** Server regeneration stays deterministic while posts reveal no solution and prior consequences genuinely affect later caverns.
- **Consequence:** Developers can study the algorithm, so secrecy is architectural rather than cryptographic.

## 2026-07-14 — Make Field Notes optional, previewed and consent-gated

- **Decision:** After voting, offer an optional structured Field Note with an exact server-built
  preview and a dedicated publish action; never auto-post and never combine consent with vote/resolve.
- **Rejected:** Posting a comment on vote; a single button that both votes and comments; free-form text.
- **Why:** UGC posted on a user's behalf must be deliberate, and the exact wording must be shown first.
- **Consequence:** Two endpoints (preview, publish); a signed token binds the previewed body to publication.

## 2026-07-14 — Default to an honest copy fallback over native User Actions

- **Decision:** Implement native `runAs: 'USER'` behind a server-authoritative flag defaulting to a
  copy-to-comments fallback; verify the returned author equals the caller before claiming a user posted.
- **Rejected:** Posting as the app account and presenting it as the user; assuming User Actions works
  before an authorized real-Reddit playtest.
- **Why:** The app must never impersonate a user; native authorship needs real authorization to verify.
- **Consequence:** Fallback works everywhere; native is enabled only after verified authorship, with
  automatic honest degrade on scope/plugin failure or author mismatch.

## 2026-07-14 — Store only minimal Field Note metadata; never text or usernames

- **Decision:** Persist a small per-note index keyed by a one-way voter hash; keep the preview token
  stateless; store no comment body, commentary, or username anywhere.
- **Rejected:** Caching comment bodies in Redis; an internal moderation copy; storing the author name.
- **Why:** Reddit is the source of truth and the moderation surface; minimization limits exposure.
- **Consequence:** Excerpts (if shown) are fetched live; the correct-minority reveal uses metadata only,
  so it survives when comment text cannot load.

## 2026-07-13 — Publish neutral posts with discoverable small references

- **Decision:** Put only schema, season, day and generator version in `postData`, with neutral titles and text fallback.
- **Rejected:** Embedding private projections, full expedition state or a sense in the title.
- **Why:** Accessibility and crash recovery need a public marker, but the social mystery needs strict minimization.
- **Consequence:** A lost create response can recover by scanning posts without leaking World Truth.
