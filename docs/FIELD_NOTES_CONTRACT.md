# Field Notes contract

Field Notes turn a player's private sense into optional, public, native Reddit discussion:
*a clue becomes valuable only when someone chooses to share it.* A note is always separate from the
vote, always previewed exactly, and always requires its own explicit consent.

## Consent and separation

1. The player votes (a prerequisite, verified server-side via their active vote).
2. A discreet **SHARE WHAT YOU SENSED** control appears — never combined with confirm/continue/resolve.
3. The player composes a structured draft.
4. The server returns the **exact** comment body.
5. A separate action publishes it: **POST AS u/{username}** (native) or **COPY FIELD NOTE** (fallback).

Nothing is ever posted automatically. Skipping a Field Note never blocks play. A published note is
public on Reddit and reportable and deletable through Reddit's native mechanisms.

## Structured draft (the only client input)

```ts
type NoteConfidence = 'low' | 'medium' | 'high';
interface FieldNoteDraft {
  direction: Direction;
  confidence: NoteConfidence;
  observationId: string;   // must belong to the caller's assigned sensor
  commentary?: string;     // optional, ≤160 chars, normalized and screened
}
```

The client can never send or force `userId`, `username`, `sensor`, `seasonId`, `postId`,
`commentId`, `safeDirection`, the result, the author, or the allowed observation set. The server
derives the user from Devvit context, recomputes the sensor with `assignSensor`, and rejects any
observation that does not belong to that sensor (`observations.ts` is server-only; `clause` never
serializes on its own).

## Comment body

```
**HEAT FIELD NOTE · EAST**

Moving warmth beyond the passage · High confidence

> Something is pacing behind the wall.
```

Deterministic from the draft + server-derived sensor. It never contains hidden World Truth, the
optimal route, usernames in the body, hashtags, marketing, or auto-links.

## Preview → publish

- `POST /api/field-notes/preview` validates the round/vote/sensor/observation/commentary, builds the
  exact body, and returns it with a **signed, expiring token** (HMAC-SHA256 over the body hash +
  identity, 10-minute TTL, installation-scoped secret). It publishes nothing.
- `POST /api/field-notes/publish` requires a separate manual action, the token, and a request id. It
  re-verifies the token (a tampered or expired token is rejected), confirms the round/user are still
  valid and no active note exists, then — in native mode — creates/reuses the chapter parent comment
  and replies as the user, verifying the returned author matches the caller. It is idempotent by
  request id and serialized by a per-user lease. It is effectively-once, not exactly-once.

## Native vs fallback (server-authoritative flag)

`FIELD_NOTES_CONFIG` in `gameConfig.ts` owns `{ enabled, publishMode }`. `publishMode` defaults to
`fallback`.

- **Native** (`runAs: 'USER'`, requires `permissions.reddit.asUser: ["SUBMIT_COMMENT"]`): posts as
  the user, verifies the real author, records the comment id, confirms publication.
- **Fallback**: never posts from the app account and never posts at all. It shows the exact body and
  offers **COPY FIELD NOTE** and **OPEN COMMENTS**; the player publishes it themselves on Reddit.

If native mode is configured but the plugin/scope is unavailable, or the returned author does not
match the caller, publication degrades honestly to fallback and is not indexed as the user's.

### The two modes do not offer the same guarantees

A manually pasted comment is a real, public, reportable Reddit comment — but it is **outside the
app's structured index**. The app cannot see it, so it must never imply otherwise.

| Guarantee | Native | Fallback |
|---|---|---|
| App creates the comment | yes (as the user) | no — the player pastes it |
| Parent Field Notes thread created/reused | yes | **no** |
| Comment id recorded / note indexed | yes | **no** |
| Shown as "published" in the app | yes | **no** — only "copied" |
| Survives reload / one-note-per-chapter enforced | yes | **no** |
| Counted in the Signal Board | yes | **no** |
| Included in the correct-minority reveal | yes | **no** (reveal is withheld entirely) |
| `onCommentDelete` desindexes it | yes | **no** — it was never indexed |

Because fallback indexes nothing, the correct-minority reveal is exposed only when contributions are
actually collectable (native mode, or when indexed notes already exist). Otherwise the app would
claim "too few Field Notes survived the noise" in a mode where it never collects any.

### Parent thread policy (decision: do not create in fallback)

The parent thread is created **only** when the first native note is about to be published. Fallback
creates no app comment of any kind, so it must not point at a thread that does not exist: its copy
reads *"Paste this into the chapter comments."* and **OPEN COMMENTS** opens the chapter post's
comments. This avoids app-account comments for notes that may never be pasted.

## One note per user per chapter

At most one active note per voter hash per chapter. A duplicate request id replays the prior result;
a second distinct request is refused with `already-active`. If a note is deleted, the player may
share a new one.

## Signal board and reveal

- The board shows aggregate counts by sensor and direction only, and only once **≥3** active notes
  exist, so no single contributor represents a sense. No usernames appear on the canvas.
- After resolution, `MinorityInsight` is computed from structured metadata only (see
  [CONSEQUENCE_SYSTEM.md](CONSEQUENCE_SYSTEM.md) for World Truth): The Chorus Held, The Minority
  Heard It, or The Hollow Kept Its Secret. It never names, ranks, or penalizes anyone.

See [UGC_MODERATION.md](UGC_MODERATION.md), [COMMENT_LIFECYCLE.md](COMMENT_LIFECYCLE.md),
[REDIS_SCHEMA.md](REDIS_SCHEMA.md#field-notes-v1) and [THREAT_MODEL.md](THREAT_MODEL.md).
