# MURMUR engineering guardrails

## Product truth

**MURMUR: One Move a Day** is a social, asynchronous Reddit game built around one thesis: **Everyone sees a different truth. The subreddit gets one move.** The intended daily loop is: Calibrate → Observe → Decide → Discuss → Return for the outcome.

The product is mobile-first. Design and validate at 360 × 800 before treating desktop as complete. Devvit must remain structural: the game runs in a Reddit Interactive Post, the Phaser client calls a Devvit Web server, and community round state uses installation-scoped Devvit Redis.

## Non-negotiable design constraints

- Preserve the bioluminescent alien-cavern identity and Murmur's original, organic silhouette.
- Do not introduce dashboard, card-grid, sidebar, table, generic neon-arcade, or SaaS UI.
- Use Phaser for game-world visuals and interactions; do not recreate them with React.
- Do not add out-of-scope features without explicit authorization. The seven-day scheduler, automatic resolution and next-post recovery are now in scope and must remain idempotent. Still prohibited: comments/Field Notes, User Actions, flair, reputation, leaderboard, economy, combat, clans, inventory, generative AI, or a second full expedition.
- Community voting, private sensor assignment, server-only World Truth, Echo, Heat, Wind, and moderator-triggered resolution are real. Never move hidden scenario types or cross-sensor data into client/shared code.
- Use only original programmatic visuals or assets with documented rights.

## Working rules

1. Inspect the repository, relevant instructions, installed types, and current configuration before modifying code.
2. Treat the installed Devvit Web packages and official current documentation as the API source of truth; never introduce legacy Blocks or `@devvit/public-api` code.
3. Keep TypeScript strict. Prefer named exports and type aliases. Never silence a type error with an unsafe cast.
4. Preserve the client/server/shared split and keep every client-facing server route under `/api`.
5. Support pointer and touch, ≥44 × 44 targets, reduced motion, and layouts without internal scroll.
6. Do not declare success without running the relevant validation commands and reporting their real output.
7. Update README, architecture, decisions, testing, limitations, and evidence after material product or engineering changes.
8. Compute playable-scene positions through `calculateLayout`; do not scatter viewport constants across scenes, effects, or entities.
9. Preserve the Header/World/Action zoning and keep South at least one touch-target plus readable clearance above contextual text.
10. New visual effects must be bounded, destroy temporary objects, and retain a reduced-motion equivalent.
11. Never accept a client-supplied user ID. Derive user, post, and subreddit identity from Devvit context; never store usernames.
12. Preserve round invariants: one active vote per voter, derived non-negative counts, immutable resolution, and idempotent request handling.
13. Production sensor assignment comes only from Devvit context. Sensor overrides belong only in tests and `vite.local.config.ts`, never query parameters or Interactive Post code.
14. Every projector constructs a fresh domain-specific payload. Run the leakage and complementarity evidence generators after perception changes.
15. Treat scheduler delivery as at-least-once. Every task and moderator command must be safe under retries, stale delivery and concurrent execution.
16. Preserve seven-day closure: Day 7 must end the expedition and no code path may create Day 8.
17. Never place route solutions or complete private projections in chapter titles, `postData`, logs, public fallbacks or pre-resolution session payloads.

## Validation commands

Run from the repository root:

```powershell
npm install
npm run type-check
npm run lint
npm test
npm run build
```

For real Reddit verification, authenticate with `npm run login` when necessary and use `npm run dev`. Do not run `npm run launch` or request App Review in this phase.
