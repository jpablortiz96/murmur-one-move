# Architecture

## Architecture in this vertical slice

```text
Reddit Interactive Post
  ├─ inline entry: splash.html + CSS world
  └─ expanded entry: game.html
                         ↓
                  Phaser 4 client
                         ↓ fetch /api/*
                  Devvit Web server
                    (Hono + Node)
```

The current client has no direct Reddit or persistence access. The server exposes real health and bootstrap routes, plus Devvit-only install/menu handlers used to create the Interactive Post. Shared TypeScript contracts validate the untrusted JSON boundary before Phaser accepts bootstrap data.

## Runtime responsibilities

- `src/client/splash.*`: lightweight inline invitation and expanded-mode request
- `src/client/game.ts`: Phaser configuration and reduced-motion/debug discovery
- `src/client/game/scenes`: bootstrap lifecycle and playable world orchestration
- `src/client/game/entities`: original Murmur drawing and animation
- `src/client/game/effects`: cave ambience and Echo reveal
- `src/client/game/ui`: scene-integrated accessible-sized controls
- `src/client/game/systems`: local decision state only
- `src/server/routes/api.ts`: `/api/health` and `/api/bootstrap`
- `src/server/core/post.ts`: Reddit custom-post creation
- `src/shared`: serializable contracts, constants, validation, and pure state types

## Target architecture (future, not implemented)

```text
Reddit Interactive Post
        ↓
Phaser Client
        ↓
Devvit Web Server
        ↓
Redis per installation/subreddit
        ↓
Reddit API and Scheduler
```

Redis will eventually hold expedition/day state within the Devvit installation boundary. The Reddit API will support post/comment community surfaces, while Scheduler will close and resolve a day. Those layers are deliberately absent now; adding placeholder writes would make the slice less honest and harder to evolve.

## Data boundary

`GET /api/bootstrap` returns display metadata, available sensor/direction identifiers, and explicit feature flags. It never claims user identity, a private assignment, a vote, or persisted community state. The client rejects malformed payloads and offers retry rather than silently substituting fake server data.

