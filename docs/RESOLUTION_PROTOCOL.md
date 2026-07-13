# Resolution protocol

1. Verify the caller is a moderator through Reddit.
2. Acquire the short round write lease.
3. WATCH metadata, active votes, and resolution.
4. Return an existing immutable resolution unchanged when present.
5. Re-derive counts and sensor diversity from active votes.
6. Choose highest vote count, then trusted sensor diversity, then deterministic tie seed.
7. Write resolution and resolved metadata in one MULTI/EXEC.
8. Reject all later vote writes.

The private world solution does not influence community vote resolution. MURMUR follows the community's chosen direction, preserving the social premise even when the community interprets its partial truths incorrectly. Internal consequence projection exists server-side for the future chapter transition, but is not sent in this phase.
