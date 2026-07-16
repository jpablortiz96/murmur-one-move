# MURMUR: One Move a Day

> Everyone sees a different truth. The subreddit gets one move.

MURMUR is a mobile-first asynchronous Reddit expedition. Each authenticated player receives a stable private Echo, Heat, or Wind projection, the subreddit commits one persistent move, and a seven-day Devvit state machine carries the resulting wounds and memories into later chapters.

## Current state

The repository contains a real Phaser + Devvit Web Interactive Post with **one hidden world truth**,
**three private senses**, **one transactional community move**, a **seven-day persistent expedition**,
**combined-truth resolution** after the snapshot is sealed, and **optional Field Notes** that turn a
private clue into native Reddit discussion.

A round with zero signals is never resolved into a direction nobody chose. Field Notes ship in an
**honest fallback**: the app shows the exact comment and the player posts it themselves — native
`runAs: 'USER'` authorship is implemented but **not claimed**, and nothing is ever posted on a user's
behalf. It is a complete technical expedition slice, not a measured public live season, and there are
**no human retention metrics**. See [LIMITATIONS.md](LIMITATIONS.md).

## Requirements and installation

- Node.js 22.2+ (validated with Node 24)
- npm 10+, Git, and a Reddit account authorized for Devvit playtesting

```powershell
npm install
npm run login
```

Devvit owns authentication credentials; never commit them.

## Run

```powershell
npm run dev -- murmur_one_move_dev
```

The playtest installs a development version and streams client/server logs. Use the subreddit menu action **Open MURMUR test expedition** to create or recover the active Day 1 post. Production windows are about 22 hours; only the exact test subreddit `murmur_one_move_dev` receives the accelerated two-minute profile.

For isolated responsive QA:

```powershell
npm run dev:local:client
```

Open `http://127.0.0.1:4173/game.html`. Local expedition and sensor fixtures exist only in `vite.local.config.ts`; they do not alter production assignment or persistence.

## Validate and reproduce evidence

```powershell
npm run type-check
npm run lint
npm test
npm run build
npm run evidence:private
npm run evidence:expedition
npm run evidence:field-notes
node tools/capture-expedition.mjs
```

The expedition evidence command executes 10,000 deterministic seven-day runs plus transition, duplicate-job, recovery, post and distribution audits. Results and protocol live in [evidence/expedition-engine](evidence/expedition-engine).

## Architecture

```text
Reddit Interactive Post
        -> Phaser client
        -> Devvit Web / Hono server
        -> installation-scoped Redis
        -> Reddit API + Devvit Scheduler
```

- `src/client/game`: scenes, sensor controllers, Murmur, organic map, reveal and moderator controls
- `src/server/game`: hidden world, expedition chapters, branching and consequences
- `src/server/services`: transactional rounds, expedition repository/coordinator, post and scheduler adapters
- `src/server/routes`: player APIs, moderator commands and internal scheduler tasks
- `src/shared`: safe client contracts and runtime validators only
- `tests`: contracts, world secrecy, voting, concurrency, state machine and presentation
- `docs` / `evidence`: protocols, decisions and reproducible results

## Implemented scope

- Stable server-authoritative Echo, Heat or Wind with distinct gesture and partial projection
- One Redis-backed active vote per user/round, atomic changes, immutable counts snapshot and deterministic tie-break
- Seven named biological chapters with branch identities derived from prior public history
- Persistent vitality, visible scars, memory fragments, condition and Chorus/Survivor/Fading endings
- `scheduled -> open -> resolving -> resolved -> next-chapter-pending -> open|completed` transitions
- One-off resolution/publication jobs, recurring reconciliation and bounded Redis leases
- Neutral chapter posts, small `postData`, accessible text fallback and previous-post links
- Three-truth reveal only after resolution, movement consequence, seven-node map and moderator recovery controls
- Optional native Field Notes: structured per-sensor comments with exact preview, explicit consent, native `runAs: 'USER'` publishing plus an honest copy-to-comments fallback, deletion handling, and a correct-minority reveal
- Mouse/touch, 44 px targets, reduced-motion equivalents and five-viewport visual matrix

## Excluded from this block

Unstructured chat, private messages, in-app up/downvotes, flair, streaks, XP, leaderboards, comment editing, LLM moderation, rewards for commenting, automatic public-season creation, notifications, external production assets and a full second expedition remain unimplemented. Native Field Note authorship (`runAs: 'USER'`) ships behind a server flag defaulting to the copy fallback until a real authorized Reddit playtest verifies authorship; see [LIMITATIONS.md](LIMITATIONS.md) and [docs/FIELD_NOTES_CONTRACT.md](docs/FIELD_NOTES_CONTRACT.md).

## Asset license

All visible art is generated at runtime with Phaser Graphics and CSS. No third-party images, fonts, music or sound files ship with this build. Repository code uses the BSD 3-Clause license in [LICENSE](LICENSE).
