# Comment lifecycle

## Parent thread

Each chapter has at most one app-authored parent comment hosting its Field Notes. It is created
lazily, under a per-day lease, when the first **native** note is about to be published — never seven
pre-emptive low-value comments. Its id is stored at `…:parent`; concurrent first notes reuse it and
never create duplicates. It is neutral (`FIELD NOTES — DAY N: …`) and is not deleted when the round
resolves. User notes are replies to it.

**In fallback no parent thread is created** (the app posts nothing at all). The composer therefore
directs the player to the chapter's general comments, never to a thread that does not exist.

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

In fallback the app performs **no** Reddit write: no parent comment, no user comment, no comment id,
no index entry, no idempotency record. The exact body is shown for the player to copy and publish
themselves in the chapter comments.

The result is a real, public, reportable Reddit comment that is **outside the app's structured
index**. The app has no way to discover a manually pasted comment, so — by design, not by omission —
a fallback note:

- is never shown as "published" (only "copied");
- does not persist in the app or survive a reload;
- is not covered by the one-note-per-chapter rule;
- is not counted in the Signal Board;
- is not included in the correct-minority reveal (which is withheld entirely in fallback);
- cannot be desindexed by `onCommentDelete` — the delete event finds no reverse index and is a no-op.

Deleting such a comment on Reddit removes it from Reddit, which is the only place it ever existed
from the app's perspective. Only native notes carry the persistence, idempotency, board and reveal
guarantees above.
