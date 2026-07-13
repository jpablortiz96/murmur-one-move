# Private-sense results

## Deterministic audits

- Assignments: 30,000; Echo 10,020 (33.400%), Heat 10,122 (33.740%), Wind 9,858 (32.860%); PASS.
- Scenarios: 1,000 generated, 1,000 valid, 0 discarded, 0 retries.
- Optimal direction distribution: North 236, East 254, South 242, West 268.
- Average plausible paths: Echo 3, Heat 2, Wind 2.
- Individual over-revelation: 0 cases.
- Missing/non-unique combined solution: 0 cases.

## Leakage

- Three projected payload variants: zero forbidden keys.
- Cross-domain violations: zero.
- Client imports from server world modules: zero.
- Generated client bundle forbidden-key hits: zero.
- Production sensor override hits: zero; one local-harness environment override intentionally present.

## Redis integration

- Trusted Heat vote stored at revision 1.
- Direction change preserved Heat at revision 2 and total 1.
- Exact retry returned idempotent revision 2 and total 1.
- No voter identifiers were written to evidence.

## Visual QA

- Normal matrix: 15/15 cases with exact document/canvas viewport, no internal scroll, three-activation cap, EAST fixture vote, and aggregate total 1.
- Reduced motion: 3/3 senses at 360×800 with touch, vote total 1, and no scroll.
- Visual inspection caught and corrected a Wind drag ending over a direction node; nodes now require their own pointerdown before selection.

Real Reddit private-sense stability and persistent voting are recorded after the human playtest and must not be inferred from this local evidence alone.
