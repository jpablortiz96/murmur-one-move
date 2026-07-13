# Product brief

## Emotional problem

Online communities are good at producing interpretations but rarely feel the cost of trusting one another. Most social games either expose complete information or turn participation into volume. MURMUR creates a gentle, suspenseful reason to say: “I saw something you did not—do you believe me?”

## Player fantasy

You are one imperfect sensory organ in a larger communal creature. You cannot save Murmur alone, but your observation may be the clue that keeps it alive.

## Core loop

1. **Calibrate** — receive a sense and understand its language.
2. **Observe** — reveal one incomplete layer of the cavern.
3. **Decide** — form a recommendation from limited evidence.
4. **Discuss** — compare incompatible truths in the Reddit thread.
5. **Return** — witness the single community move and its consequence.

The current vertical slice implements stable private Echo/Heat/Wind perception over one hidden server-only truth, one persistent active vote per authenticated player, aggregate community results, manual moderator resolution, and consequence playback.

## Community role and Reddit fit

Reddit supplies persistent posts, threaded debate, subreddit identity, moderation, recurring visits, and an installation-scoped game boundary in one surface. A standalone game could copy voting, but it would have to rebuild the living community whose disagreements are the playfield. MURMUR needs the post and its discussion to be the shared expedition room, not a link beside the game.

## Audience

- Reddit communities that enjoy collaborative mysteries, daily rituals, ARG-like interpretation, and low-pressure games
- Mobile players who can contribute in under two minutes
- Spectators who enjoy reasoning from other players' reports even when they arrive late

## Design principles

- Partial truth, not random opacity
- One meaningful communal consequence, not many disposable clicks
- Legible in seconds; discussable for hours
- Mystery without visual clutter
- Tension without manipulative urgency
- Honest boundaries between demonstration and live systems
- Mobile touch as the baseline interaction

## Included now

- Immersive inline entry, expanded Phaser cavern, original Murmur silhouette
- Echo reveal with three-pulse cap
- Distinct Heat hold-focus and Wind drag-tracer interactions with three-use caps
- Server-only scenario generation, safe partial projections, and balanced stable assignment
- Four-way selection, explicit confirmation, persistent vote change, replay, aggregate counts, and pending outcome
- Installation-scoped Redis state, idempotent requests, concurrent-write protection, moderator-only manual resolution, immutable snapshot, and audit hash
- Typed server bootstrap, health endpoint, failure/retry states, debug mode
- Responsive and reduced-motion foundations

## Explicitly excluded

Scheduler, automatic daily resolution, automatic next-post creation, real per-user sensor assignment, comments automation, User Actions, flair, reputation, leaderboards, streaks, currencies, store, crafting, combat, clans, inventory, generative AI, definitive maps, cross-subreddit play, notifications, full Heat/Wind senses, App Review, and Devpost submission.
