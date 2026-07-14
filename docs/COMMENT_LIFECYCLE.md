# Comment lifecycle

## Parent thread

Each chapter has at most one app-authored parent comment hosting its Field Notes. It is created
lazily, under a per-day lease, when the first native note is about to be published — never seven
pre-emptive low-value comments. Its id is stored at `…:parent`; concurrent first notes reuse it and
never create duplicates. It is neutral (`FIELD NOTES — DAY N: …`) and is not deleted when the round
resolves. User notes are replies to it.

## Create (native)

1. Preview issues a signed token bound to the exact body and the caller's voter hash.
2. Publish re-verifies the token, the open round, the prior vote, and that no active note exists.
3. Ensure the parent (create-or-reuse under lease).
4. Reply as the user (`runAs: 'USER'`); verify the returned author equals the caller.
5. Persist minimal metadata, the reverse `comment → {season,day,voter}` index, and the idempotency
   marker together.

Idempotent by request id; serialized per user by a lease. **Effectively-once, not exactly-once:** a
response lost after Reddit accepts the comment but before the index write can, in a narrow window,
leave a comment visible on Reddit that is not indexed. A retry with the same request id replays;
this posture matches the expedition [RECOVERY_PROTOCOL](RECOVERY_PROTOCOL.md).

## Delete

The `onCommentDelete` trigger carries a `commentId`. The reverse index resolves it to
`{season, day, voterHash}`; the note's status is set to `deleted` and it drops out of the board and
the minority reveal. This is idempotent and safe for duplicate, out-of-order, and unindexed events —
each is a no-op. No comment text is retained; the player may then share a new note.

The `onPostDelete` trigger desindexes every active note for that chapter of the active expedition
(`purgeDay`), retaining only minimal metadata for integrity. Deleted content is never copied into
expedition history.

## Read (reveal)

The correct-minority reveal and the signal board are computed from stored structured metadata only,
so they never depend on live comment availability and never expose identity. Live comment text, if
ever shown, is fetched from Reddit at read time, bounded, escaped, and skipped when deleted — it does
not block resolution.

## Fallback

In fallback mode nothing is created, indexed, or marked published: the exact body is shown for the
player to copy into the comments themselves. No parent comment is created on their behalf.
