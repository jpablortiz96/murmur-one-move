# Scheduler protocol

## Jobs

`devvit.json` declares two one-off tasks and one recurring recovery task:

- `resolve-round`: scheduled for `closesAt`; transitions open -> resolving, freezes the round and applies the consequence.
- `publish-next-chapter`: scheduled for `nextChapterAt`; finds or creates the next neutral Interactive Post and opens its round.
- `reconcile-expedition`: every five minutes, inspects the active installation state and repairs a missing safe step.

Task payloads carry `subredditId`, `seasonId`, target day and operation ID. The route verifies the payload against real Devvit installation context. It never accepts a voter identity.

## Delivery semantics

Devvit Scheduler is treated as at-least-once. A successful scheduling marker prevents normal reconciliation from enqueueing duplicates, but correctness does not depend on single delivery. Per-day resolve/publish leases, immutable history, stored `postsByDay`, post discovery and stale-day checks make repeated or concurrent jobs converge on the existing state.

The production profile uses an approximate 22-hour voting window and delayed reveal/publication. The exact `murmur_one_move_dev` test community uses two-minute windows. UI copy is approximate—hours/minutes, never a stressful second counter.

## Manual controls

Live moderators can close, resolve, publish and reconcile through separate two-step Phaser controls backed by moderator-only routes. Manual resolution can bypass the clock but cannot bypass state, identity, terminal Day 7 or immutable snapshot rules.
