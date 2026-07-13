# Seven-day expedition results

Date: 2026-07-13.

## 10,000 complete expeditions

- Resolved chapters: 70,000; Day 8 creations: 0.
- Endings: Chorus 1,577; Survivor 6,020; Fading 2,403.
- Consequences: safe 17,734; costly 34,743; dangerous 17,523.
- Final vitality: 0 = 2,403; 1 = 3,203; 2 = 3,050; 3 = 1,344.
- Average vitality Day 1..7: 2.7533, 2.4958, 2.2415, 2.0001, 1.7622, 1.5414, 1.3335.
- Unique final branch hashes: 10,000.
- Impossible states, invalid states and blocked simulations: 0.
- Reproducibility hash: `sha256:f880203db1da23b784fc1c04b6428d83231a8e57858d746b77f3ef86b31ce3e6`.

## Concurrency, jobs and recovery

- 100 resolve workers produced 1 immutable resolution and 1 audit hash.
- 100 publish workers produced 1 next-day post.
- Repeated manual/scheduler delivery produced one state transition and reopened 0 rounds.
- Lost create response, expired lease and worker interruption were recovered; duplicate posts and corrupted counters: 0.
- Seven chapter posts had neutral titles and text fallback. Maximum serialized `postData`: 78 bytes. Forbidden private-field hits: 0. Day 8 created: false.

## Visual inspection

- Required viewport inner/document/canvas dimensions matched for every case; all recorded scroll positions were `[0,0]`.
- Captures cover open map, resolving, combined truth, consequence, next-day control and completed ending.
- Mobile controls remain inside 360×800; combined truth is readable at 360×800 and 1280×720.
- Reduced motion renders the same information without relying on staged tween timing.
- A header collision found during inspection was corrected by moving condition copy beside the organic node line; captures were regenerated afterward.

## Real Reddit gate

- App `murmur-one-move` installed in `r/murmur_one_move_dev` as `v0.0.2.49`.
- Playtest root: `https://www.reddit.com/r/murmur_one_move_dev/?playtest=murmur-one-move`.
- The authenticated moderator completed the assigned sense, vote, two-step resolution, combined three-truth reveal, consequence and `PUBLISH NEXT DAY` flow.
- The moderator opened Day 2, ran reconciliation and reported: “Día 2 abierto sin duplicados. La condición de Murmur y el historial se conservaron.”
- The individual Day 1/Day 2 URLs and season ID were not retained by the CLI watcher after installation, so they are recorded as unavailable rather than reconstructed.
- This proves the manual recovery path and real Reddit post transition. Delivery solely by the timed one-off Scheduler, without moderator controls, remains a separate operational observation.
