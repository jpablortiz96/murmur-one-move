# Private-sense evidence protocol

## Automated contracts and audits

```powershell
npm install
npm run type-check
npm run lint
npm test
npm run build
npm run evidence:private
```

`evidence:private` rebuilds the client, simulates 30,000 identities, generates/validates 1,000 scenarios, checks complementarity and forbidden payload keys, exercises trusted-sensor Redis changes/retries, scans client source/bundle boundaries, writes JSON, and renders plots from that JSON.

## Visual matrix

```powershell
node tools/capture-private-senses.mjs
node tools/capture-private-senses.mjs --reduced
```

The script launches the local-only harness separately for Echo, Heat, and Wind. It tests 360×800, 390×844, 412×915, 768×1024, and 1280×720; uses touch below 768 px; performs four activation attempts to confirm the cap remains three; selects EAST; confirms a fixture vote; and records document/canvas/scroll geometry. Reduced motion repeats all senses at 360×800.

The local sensor override is an environment variable consumed only by `vite.local.config.ts`. It is unavailable in the production Interactive Post.

## Reddit protocol

Create a new MURMUR post. Do not alter the Phase 3 resolved post. Open the new post, enter the signal, record the assigned sense, reload, complete three activations, confirm a vote, reload, change direction, and verify aggregate total remains one. Do not resolve the new round until server checks and logs are complete.
