# Judges: start here

MURMUR makes Reddit's native behavior—people comparing incomplete interpretations—its game system. Every player sees one private sense. The subreddit casts one consequential move. Seven posts remember the result.

## Playable journey

1. Enter a neutral chapter post and receive stable Echo, Heat or Wind.
2. Complete up to three sense-specific interactions and choose a direction.
3. Confirm one persistent vote; change it while the round is open without increasing the total.
4. Watch aggregate intent without seeing voter identities or hidden World Truth.
5. Let the scheduler—or a moderator recovery control—freeze the round.
6. See all three perspectives only after the snapshot is immutable.
7. Optionally share a **Field Note**: pick what your sense revealed, see the exact comment, and post
   it as yourself (or copy it) — separate from the vote, never automatic.
8. Watch Murmur move, gain memory, carry a visible scar or lose vital light.
9. See whether the community held the path — or whether a correct minority heard the danger.
10. Open the next Reddit chapter; the seven-node map and creature state preserve the journey.
11. Complete Day 7 as Chorus, Survivor or Fading. Day 8 cannot be created.

## What is honestly not claimed

- Native Field Note authorship (`runAs: 'USER'`) is implemented and permissioned but **disabled by
  default**; Field Notes ship as an honest copy-to-comments fallback that never posts as a user.
- There are **no human retention or discussion-quality metrics**. Every large number here is a
  deterministic simulation of our own engine.
- A round with **zero signals is never resolved**: MURMUR will not follow a direction nobody chose.

## Why the implementation matters

- Devvit is structural: identity, posts, Redis, moderator authorization and Scheduler are server responsibilities.
- World Truth never enters shared/client code before the safe combined reveal.
- Active votes are the aggregate source of truth; snapshots are immutable and auditable.
- Scheduler delivery is treated as at-least-once. Repetition produces the existing transition/post/result.
- The chapter post title and fallback never reveal a private sense or correct route.
- The evidence pack contains 10,000 complete expeditions, 100-way duplicate calls, lost-response recovery, five viewport classes and reduced motion.

## Review path

- [Evidence index](evidence/README.md)
- [Field Notes contract](docs/FIELD_NOTES_CONTRACT.md)
- [UGC moderation & privacy](docs/UGC_MODERATION.md)
- [Comment lifecycle](docs/COMMENT_LIFECYCLE.md)
- [Expedition model](docs/EXPEDITION_MODEL.md)
- [Scheduler protocol](docs/SCHEDULER_PROTOCOL.md)
- [Consequence system](docs/CONSEQUENCE_SYSTEM.md)
- [Chapter posts](docs/CHAPTER_POSTS.md)
- [Recovery protocol](docs/RECOVERY_PROTOCOL.md)
- [Testing](docs/TESTING.md)
- [Evidence results](evidence/expedition-engine/RESULTS.md)
- [Limitations](LIMITATIONS.md)
