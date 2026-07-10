# MURMUR: One Move a Day

> Everyone sees a different truth. The subreddit gets one move.

MURMUR is a mobile-first asynchronous social game for Reddit. A small bioluminescent creature crosses an unknown cavern while different players eventually receive different perceptual clues. The community must discuss those incomplete truths and commit to one shared move.

## Current state

This repository contains the first playable **Echo vertical slice** for a Reddit Interactive Post. The inline world invites a player to enter the signal; the expanded Phaser experience loads typed bootstrap data from the Devvit Web server, lets the player reveal the cave with up to three Echo pulses, and records a local pending direction without moving Murmur.

This is intentionally not the daily multiplayer expedition yet. See [LIMITATIONS.md](LIMITATIONS.md).

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
│   └── routes/        # Health/bootstrap and Devvit handlers
└── shared/
    ├── constants/
    ├── contracts/
    └── types/
```

Supporting product and engineering documents live in `docs/`; concrete verification artifacts and instructions live in `evidence/`.

## Implemented scope

- Original programmatic cave, fog, particles, Murmur creature, Echo wave, wall trace, hollow-route clue, and abstract danger clue
- Mouse/touch interaction, maximum of three pulses, four directional choices, change/replay, and pending-state copy
- Responsive layout and reduced-motion behavior
- Opt-in debug overlay through `?debug=1`
- Real `GET /api/health` and typed `GET /api/bootstrap`
- Loading, malformed-response, error, and retry states
- Local decision-state and contract unit tests

## Asset license

All visible art is generated at runtime with Phaser Graphics and browser CSS. No third-party images, fonts, music, or sound files ship with this slice. Repository code is licensed under the BSD 3-Clause license in [LICENSE](LICENSE).

