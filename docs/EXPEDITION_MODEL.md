# Expedition model

## Identity and lifetime

An expedition is installation-scoped and identified by `subredditId + seasonId`. Its schema is V2. Each scenario identity adds `day`, the hash of previous immutable summaries, and `generatorVersion`; therefore the same prior journey regenerates the same hidden cavern while a different consequence history branches deterministically.

The seven chapters are The First Hollow, The Breathing Wall, The Sleeping Heat, The Spore Choir, The Broken Current, The Chamber That Remembers and The Last Resonance.

## State machine

```text
scheduled -> open -> resolving -> resolved -> next-chapter-pending
                 ^                                  |
                 |-------- next day (1..7) ---------|
                                                    -> completed (Day 7 only)
```

Every transition records previous/next revision, timestamp, cause, operation ID and audit hash. Invalid edges fail closed. Moderator close changes only the open window timestamp and records a same-state revision; it does not resolve the vote itself.

## Persistent public condition

- Vitality: integer `0..3`; dangerous consequences remove one light.
- Memory fragments: non-negative; safe passages add one.
- Scars: unique visible tags accumulated by costly/dangerous passages.
- Condition: bright, stable, strained or fading, derived from vitality/scars.
- History: one immutable summary for each resolved day, including post, winner, snapshot, branch hash and audit reference.

Day 7 selects exactly one ending: `chorus` for strong memory and remaining light, `fading` at zero vitality, otherwise `survivor`. Completion is terminal and `publishNext` returns the existing completed state.

## Public boundary

The client receives chapter copy, approximate window, condition, scars, memory, compact history and ending. It never receives future scenarios, safe routes or unresolved combined projections. The combined Echo/Heat/Wind truth is projected only from an immutable resolved history entry for the current post.

Each chapter also hosts optional native Field Notes and, after resolution, a correct-minority reveal
computed from structured note metadata only. Field Notes compose over the round/expedition state but
never alter votes, World Truth, consequences, or the seven-day closure. See
[FIELD_NOTES_CONTRACT.md](FIELD_NOTES_CONTRACT.md).
