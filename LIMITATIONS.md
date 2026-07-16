# Current limitations

- **Native Field Note authorship is not claimed.** `runAs: 'USER'` is implemented and permissioned
  (`asUser: ["SUBMIT_COMMENT"]`) but the server default is the honest copy-to-comments fallback, and
  real authorship has never been verified on Reddit. Nothing is ever posted on a user's behalf.
- **OPEN COMMENTS is verified only up to the handler.** It now calls Devvit's client `navigateTo`
  with the canonical comments URL (proven in a real browser), but `navigateTo` is fire-and-forget, so
  whether Reddit opens the comments inside the Interactive Post is not yet human-verified.
- **No human retention, return-rate or discussion-quality metrics exist.** The 10,000-run figures are
  deterministic simulations of our own engine, not people.

- This is a seven-day technical expedition slice in one development community, not a measured public live season.
- Optional native Field Notes (structured sensor comments, exact preview, explicit consent, correct-minority reveal) are implemented. Native `runAs: 'USER'` authorship is implemented and permissioned (`asUser: ["SUBMIT_COMMENT"]`) but the server default is the honest copy-to-comments fallback; real user authorship and the Field Notes client visual matrix are not yet verified on real Reddit and are recorded as pending in `evidence/field-notes/raw/reddit-playtest.json`.
- In the default fallback mode the app performs no Reddit write at all: it shows the exact body and the player pastes it into the chapter comments themselves. Such a comment is real, public and reportable but is **outside the app's structured index** — it creates no parent thread, is never marked published, does not persist in the app, is not counted in the Signal Board, is not included in the correct-minority reveal (which is withheld in fallback), and cannot be desindexed by `onCommentDelete`. Persistence, idempotency, board counting, the reveal and delete-desindexing are **native-only** guarantees.
- Field Note recovery is effectively-once, not exactly-once: a response lost after Reddit accepts a comment but before the index write can leave a comment that is visible on Reddit yet unindexed until the user retries.
- Field Note deletion desindexing covers the active expedition; a chapter-post deletion in a completed/older season is not retroactively purged.
- Flair, streaks, XP, leaderboards, unstructured chat, private messages, in-app voting, comment editing, LLM moderation and notifications are not implemented.
- No human seven-day retention, return-rate, decision-quality or discussion-quality metrics exist yet.
- The real moderator-driven Day 1 -> Day 2 transition and reconciliation were human-verified in Reddit; timed one-off Scheduler delivery without moderator controls has not yet been observed end-to-end.
- Concurrency and duplicate delivery are simulated against Devvit's Redis test runtime; they are not a production traffic load test.
- The deterministic generator is server-only but not a cryptographic secret. A developer with source access can study its behavior.
- Procedural Phaser visuals are original and intentional but provisional; there are no external final assets, music or sound design.
- Condition and scars have non-color visual marks, but Phaser canvas controls still lack full screen-reader semantics and keyboard navigation.
- CSS safe-area behavior needs physical notched iOS/Android verification inside the Reddit app.
- Moderator authorization depends on live Reddit moderator context and cannot be represented by the local visual harness.
- Recovery is effectively-once, not exactly-once: duplicate task delivery may occur, while immutable transitions, post discovery and leases prevent duplicate state effects.
- A post creation response lost after Reddit creates the post is recovered by scanning recent posts for the small season/day reference; an extended Reddit outage delays recovery.
- Only the exact development subreddit receives two-minute windows; production uses the approximate 22-hour cadence.
- Earlier Phase 3 and Phase 4 posts remain on schema V1 and are intentionally not migrated or rewritten.
- The final CLI watcher ended after installation and did not retain the individual Day 1/Day 2 URLs or season ID; the human-visible transition is recorded, but those identifiers are unavailable in the evidence pack.
- There is no second complete expedition/chapter set or authoring tool.
- `npm audit` transitive findings in the Devvit CLI/test chain are documented rather than force-fixed with an incompatible major update.
