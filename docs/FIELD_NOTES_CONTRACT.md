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
- **Fallback**: never posts from the app account. Shows the exact body, offers **COPY FIELD NOTE**
  and **OPEN COMMENTS**, instructs the player to paste it, and does **not** mark it published or
  index it as a structured contribution.

If native mode is configured but the plugin/scope is unavailable, or the returned author does not
match the caller, publication degrades honestly to fallback and is not indexed as the user's.

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
