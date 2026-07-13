# MURMUR: One Move a Day

> Everyone sees a different truth. The subreddit gets one move.

MURMUR is a mobile-first asynchronous social game for Reddit. A small bioluminescent creature crosses an unknown cavern while different players eventually receive different perceptual clues. The community must discuss those incomplete truths and commit to one shared move.

## Current state

This repository contains a **private-perception community round** for a Reddit Interactive Post. The server creates one hidden cavern truth, assigns each authenticated player a stable Echo, Heat, or Wind sense, returns only that sense's projection, and binds the trusted assignment to persistent Redis voting.

This is a real multiplayer round foundation, but not the automated daily expedition yet. See [LIMITATIONS.md](LIMITATIONS.md).

## Requirements

- Node.js 22.2 or newer (the project is currently validated with Node 24)
- npm 10 or newer
- Git
- A Reddit account authorized for Devvit playtesting

## Install

```powershell
npm install
```

## Authenticate Devvit

```powershell
npm run login
```

The command opens Reddit authorization in a browser. Credentials are managed by the Devvit CLI and must never be committed.

## Run a Reddit playtest

```powershell
npm run dev
```

Devvit uploads a development build, creates or reuses a private test subreddit, installs the app, streams logs, and prints the Reddit URL. The subreddit menu action **Create a MURMUR post** creates another Interactive Post when needed.

For responsive client QA without a Reddit iframe, start the local client harness:

```powershell
npm run dev:local:client
```

Open `http://127.0.0.1:4173/game.html`. The harness uses isolated local session/vote fixtures for visual QA only. Select a local sense before startup with `$env:MURMUR_LOCAL_SENSOR='heat'`; production code has no sensor override.

## Validate

```powershell
npm run type-check
npm run lint
npm test
npm run build
```

`type-check` runs the strict TypeScript project references, `lint` runs ESLint, `test` runs the lightweight unit suite, and `build` produces the Devvit client/server bundles.

## Project shape

```text
src/
├── client/
│   ├── game/          # Phaser scenes, entity, effects, UI, state
│   ├── game.ts        # Expanded entrypoint
│   ├── splash.ts      # Inline entrypoint
│   └── *.html/*.css
├── server/
│   ├── core/          # Interactive Post creation
│   ├── routes/        # Health/bootstrap, round API, Devvit handlers
│   └── services/      # Round keys and transactional state service
└── shared/
    ├── constants/
    ├── contracts/
    └── types/
```

Supporting product and engineering documents live in `docs/`; concrete verification artifacts and instructions live in `evidence/`.

The inspected five-viewport matrix, before/after comparison, and performance notes are in [docs/VISUAL_AUDIT.md](docs/VISUAL_AUDIT.md).

## Implemented scope

- Original programmatic cave, fog, particles, Murmur creature, Echo wave, wall trace, hollow-route clue, and abstract danger clue
- Deterministic server-only World Truth with validated structural, thermal, airflow, and internal consequence domains
- Stable, versioned, balanced sensor assignment derived only from Devvit user/post context
- Fresh Echo/Heat/Wind projections that never cross domain boundaries
- Echo touch pulses, Heat press-and-hold focus, and Wind drag tracers, each capped at three activations
- Mouse/touch interaction, four directional choices, explicit confirmation, change/replay, and resolved consequence
- Centralized Header/World/Action layout with safe-area, density, and wide-orientation rules
- Cave-integrated resonant direction nodes and distinct visual responses for Echo pulses 1–3
- Reduced-motion equivalents for camera, ambience, creature, node, and Echo motion
- Opt-in debug overlay through `?debug=1`
- Real `GET /api/health` and typed `GET /api/bootstrap`
- Redis-backed `GET /api/round`, `POST /api/round/vote`, and moderator-only `POST /api/round/resolve`
- Exactly one active vote per authenticated user/round, idempotency keys, atomic vote changes, aggregate counts, deterministic tie-breaking, and immutable audit hashes
- Guest exploration without fake voting and server-derived user/post/subreddit identity
- Loading, malformed-response, error, and retry states
- Contract, decision-state, Redis transaction/concurrency, resolution, and layout tests
- 30,000-assignment balance audit, 1,000-scenario complementarity audit, client-bundle leakage scan, five-viewport matrix, and reduced-motion captures

The round model is documented in [docs/TRANSACTIONAL_VOTING.md](docs/TRANSACTIONAL_VOTING.md); the hidden model and safe boundary are in [docs/WORLD_MODEL.md](docs/WORLD_MODEL.md) and [docs/PRIVATE_PERCEPTION_CONTRACT.md](docs/PRIVATE_PERCEPTION_CONTRACT.md).

## Asset license

All visible art is generated at runtime with Phaser Graphics and browser CSS. No third-party images, fonts, music, or sound files ship with this slice. Repository code is licensed under the BSD 3-Clause license in [LICENSE](LICENSE).
