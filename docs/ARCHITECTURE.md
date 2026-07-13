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
                    ↙           ↘
       installation Redis       Reddit API
       votes + resolution       moderator check
```

The client owns presentation and an optimistic-free selection draft. The server owns identity, round state, active votes, aggregate derivation, authorization, resolution, and audit data. Shared TypeScript contracts validate every JSON boundary.

## Runtime responsibilities

- `src/client/splash.*`: lightweight inline invitation and expanded-mode request
- `src/client/game.ts`: Phaser configuration and reduced-motion/debug discovery
- `src/client/game/scenes`: bootstrap, observation, vote lifecycle, resolution playback
- `src/client/game/entities`: original Murmur drawing, orientation, and movement
- `src/client/game/effects`: cave ambience and Echo reveal
- `src/client/game/ui`: scene-integrated accessible-sized controls
- `src/client/game/systems`: local selection state and typed round client
- `src/server/routes/api.ts`: `/api/health` and `/api/bootstrap`
- `src/server/routes/round.ts`: context-derived round/vote/resolve HTTP boundary
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

## Future architecture (not implemented)

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

The next architecture block is server-authoritative World Truth and private sensor projections. Scheduler will later close a day and create the next post, but neither is present now.

## Data boundary

`GET /api/bootstrap` returns display metadata and feature flags. `GET /api/round` returns only the authenticated caller's own vote plus anonymous aggregates and public resolution. Vote and resolve routes reject invalid payloads at runtime. Internal voter keys and raw vote maps are never returned.
