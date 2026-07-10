# MURMUR engineering guardrails

## Product truth

**MURMUR: One Move a Day** is a social, asynchronous Reddit game built around one thesis: **Everyone sees a different truth. The subreddit gets one move.** The intended daily loop is: Calibrate → Observe → Decide → Discuss → Return for the outcome.

The product is mobile-first. Design and validate at 360 × 800 before treating desktop as complete. Devvit must remain structural: the game runs in a Reddit Interactive Post, the Phaser client calls a Devvit Web server, and later community state will use installation-scoped Reddit capabilities.

## Non-negotiable design constraints

- Preserve the bioluminescent alien-cavern identity and Murmur's original, organic silhouette.
- Do not introduce dashboard, card-grid, sidebar, table, generic neon-arcade, or SaaS UI.
- Use Phaser for game-world visuals and interactions; do not recreate them with React.
- Do not add out-of-scope features without explicit authorization. In particular: no Redis, scheduler, daily resolution, comments, flair, reputation, leaderboard, economy, combat, clans, inventory, generative AI, or full Heat/Wind gameplay in this phase.
- Do not present local demonstrations as persistence, privacy, or live community behavior.
- Use only original programmatic visuals or assets with documented rights.

## Working rules

1. Inspect the repository, relevant instructions, installed types, and current configuration before modifying code.
2. Treat the installed Devvit Web packages and official current documentation as the API source of truth; never introduce legacy Blocks or `@devvit/public-api` code.
3. Keep TypeScript strict. Prefer named exports and type aliases. Never silence a type error with an unsafe cast.
4. Preserve the client/server/shared split and keep every client-facing server route under `/api`.
5. Support pointer and touch, ≥44 × 44 targets, reduced motion, and layouts without internal scroll.
6. Do not declare success without running the relevant validation commands and reporting their real output.
7. Update README, architecture, decisions, testing, limitations, and evidence after material product or engineering changes.

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

