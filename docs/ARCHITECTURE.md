# Architecture

## Current runtime

```text
Reddit Interactive Post
  ├── inline entry: splash.html + CSS world
  └── expanded entry: game.html
                         ↓
                  Phaser 4 client
                         ↓ fetch /api/*
                  Devvit Web server
                    (Hono + Node)
                    ↓
      server-only scenario + assignment + projector
                    ↓
          safe `PlayerSession` projection
                    ↙           ↘
       installation Redis       Reddit API
       votes + resolution       identity/moderator context
```

The client owns presentation and an optimistic-free selection draft. The server owns identity, round state, active votes, aggregate derivation, authorization, resolution, and audit data. Shared TypeScript contracts validate every JSON boundary.

## Runtime responsibilities

- `src/client/splash.*`: lightweight inline invitation and expanded-mode request
- `src/client/game.ts`: Phaser configuration and reduced-motion/debug discovery
- `src/client/game/scenes`: bootstrap/session lifecycle, shared vote lifecycle, resolution playback
- `src/client/game/sensors`: isolated Echo, Heat, and Wind input/render controllers
- `src/client/game/entities`: original Murmur drawing, orientation, and movement
- `src/client/game/effects`: cave ambience and Echo reveal
- `src/client/game/ui`: scene-integrated accessible-sized controls
- `src/client/game/systems`: local selection state and typed round client
- `src/server/routes/api.ts`: `/api/health` and `/api/bootstrap`
- `src/server/routes/round.ts`: context-derived round/vote/resolve HTTP boundary
- `src/server/routes/session.ts`: authoritative player assignment, safe projection, and round view
- `src/server/game/world`: hidden model, deterministic generator, validation, and internal consequence projection
- `src/server/game/sensors`: stable assignment and three independent safe projectors
- `src/server/services/roundService.ts`: Redis transactions, invariants, and resolution
- `src/server/services/roundKeys.ts`: versioned installation-scoped keys and hashes
- `src/shared`: serializable contracts, runtime validation, constants, and pure types

## Round data flow

```text
direction draft
    ↓ explicit confirmation
POST /api/round/vote
    ↓ derive context.userId + postId + subredditId
round write lease → WATCH → read active votes → MULTI/EXEC
    ↓
active-vote hash (source of truth)
    ↓ derive on every read
non-negative aggregate counts

moderator two-step control
    ↓ Reddit moderator authorization
POST /api/round/resolve
    ↓ same serialized transaction boundary
immutable resolution snapshot + audit hash
    ↓
Phaser consequence playback
```

No username or client-supplied identity enters the model. A one-way SHA-256 field key prevents raw Reddit user IDs from being stored in the vote hash. See [TRANSACTIONAL_VOTING.md](TRANSACTIONAL_VOTING.md).

## Session boundary

`GET /api/bootstrap` contains static product metadata and honest capability flags. `GET /api/session` is the only read model for player assignment, perception, active vote, aggregates, and public resolution. `/api/round/*` contains write commands only.

World generation and assignment accept post/user identifiers from Devvit context, never HTTP input. `WorldTruth`, the optimal direction, survivability, and consequence IDs remain under `src/server`; only the assigned discriminated perception is serialized.

## Expedition runtime (implemented)

```text
Reddit Interactive Post
        ↓
Phaser Client
        ↓
Devvit Web Server
        ↓
installation-scoped Redis
        ↓
Reddit API + Scheduler
```

The V2 expedition repository owns versioned state and transition history. `ExpeditionCoordinator` is the single orchestration boundary for starting, resolving, publishing and reconciliation. Devvit adapters perform custom-post discovery/creation, text-fallback updates and one-off scheduling. Internal task routes verify installation context before invoking the coordinator.

Round V1 remains the per-post vote engine. V2 composes it rather than duplicating votes: the round freezes counts and the expedition applies the hidden consequence, appends history and opens the next post. Shared contracts contain only public journey state and the post-resolution combined projection.

See [EXPEDITION_MODEL.md](EXPEDITION_MODEL.md), [SCHEDULER_PROTOCOL.md](SCHEDULER_PROTOCOL.md) and [RECOVERY_PROTOCOL.md](RECOVERY_PROTOCOL.md).

## Data boundary

`GET /api/bootstrap` returns display metadata and feature flags. `GET /api/session` adds only the current player's assignment/projection, their vote, aggregate state and safe expedition view. `/api/expedition` returns the public journey. `/api/field-notes` (GET view, POST `/preview`, POST `/publish`) hosts optional native Field Notes; `/internal/triggers/on-comment-delete` and `/on-post-delete` desindex deleted content. Moderator commands live under `/api/mod/*`; scheduler tasks live under `/internal/scheduler/*`. Internal voter keys, raw vote maps, future scenarios, unresolved combined truth, comment bodies and usernames are never returned.

## Field Notes runtime

```text
vote (prerequisite)
    ↓
POST /api/field-notes/preview  → server-built exact body + signed token (no publish)
    ↓ explicit separate consent
POST /api/field-notes/publish  → verify token + author → native runAs:'USER' | honest fallback
    ↓
minimal Redis index (no text/usernames) ── onCommentDelete/onPostDelete → desindex
    ↓ after resolution
metadata-only correct-minority reveal
```

`FieldNoteService` orchestrates preview/publish/view over `FieldNoteRepository` (minimal metadata,
leases, idempotency) and a `CommentGateway` (parent-thread reuse + user reply). World Truth stays
server-side; the reveal reads only structured note metadata. See [FIELD_NOTES_CONTRACT.md](FIELD_NOTES_CONTRACT.md).
