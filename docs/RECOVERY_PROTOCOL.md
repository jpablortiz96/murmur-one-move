# Recovery protocol

Recovery is designed for crashes, duplicate task delivery, lost create responses and partially completed transitions.

1. Read the installation's active season and validate V2 state.
2. Acquire the relevant bounded Redis lease.
3. If scheduled with no Day 1 record, discover/create Day 1.
4. If open before close, ensure one scheduling marker exists and stop.
5. If open after close, resolve.
6. If resolving, inspect the immutable round snapshot; apply it if present or retry resolution.
7. If resolved, append the pending transition.
8. If pending before `nextChapterAt`, ensure publication is scheduled and stop.
9. If pending after its time, discover/create the next post.
10. If completed, do nothing.

Post creation uses a write intent plus Reddit discovery because an HTTP response can be lost after Reddit has already created the post. Resolution and publication are idempotent by state/history/post identity, not by trusting a task delivery count.

Failures are surfaced. Leases expire and bounded contention returns an explicit busy error; no catch block silently invents progress. Logs contain season/day/status and post identity only—never usernames, voter hashes, full hidden scenarios or correct-route fields.
