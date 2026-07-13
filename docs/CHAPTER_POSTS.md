# Chapter post protocol

Each day is a new Reddit Interactive Post. Titles are neutral: `MURMUR — Day N: {chapter}`. They never name a player's sense, winner or correct route.

`postData` is intentionally small and recoverable:

```json
{"murmur":{"v":2,"seasonId":"...","day":2,"generatorVersion":3}}
```

It contains no World Truth, projections, votes or identity. The accessible text fallback describes the chapter and how to open the interactive experience. After resolution it adds public counts/consequence; once the next post exists it links forward.

Publication first searches recent subreddit posts for the same V2 season/day reference. Only when none exists does it call `submitCustomPost`. The returned post ID is persisted in both expedition state and a dedicated Redis key before later operations rely on it.

Old V1 posts stay readable and are not mutated into V2 expeditions.
