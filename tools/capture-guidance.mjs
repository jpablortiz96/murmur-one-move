import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Real-browser verification of sensor guidance and fallback comments navigation.
 * Reuses the existing Chrome headless + CDP harness — no DOM emulator, because
 * the defects were about layout, blocked webview navigation and real clicks.
 */
const root = process.cwd();
const evidence = join(root, 'evidence', 'fallback-navigation-guidance');
const shots = join(evidence, 'screenshots');
const raw = join(evidence, 'raw');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = join(root, '.tmp-guidance-chrome');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(shots, { recursive: true });
mkdirSync(raw, { recursive: true });

const viewports = [
  { width: 360, height: 800, reduced: false },
  { width: 390, height: 844, reduced: false },
  { width: 412, height: 915, reduced: false },
  { width: 768, height: 1024, reduced: false },
  { width: 1280, height: 720, reduced: false },
  { width: 360, height: 800, reduced: true },
];

const waitFor = async (url, attempts = 120) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const connect = async () => {
  const targets = await (await fetch('http://127.0.0.1:9228/json/list')).json();
  const target = targets.find((item) => item.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('Chrome page target unavailable');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const callback = pending.get(message.id); pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message)); else callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, send };
};

const terminate = (child) => { if (child && !child.killed) child.kill('SIGTERM'); };

/**
 * SIGTERM does not reliably kill node/Chrome on Windows. Vite uses strictPort, so
 * a survivor would silently serve the NEXT case with the PREVIOUS env fixture.
 * Tear down by PID and wait until the ports are actually free.
 */
const killTree = (pid) => new Promise((resolve) => {
  if (!pid) { resolve(); return; }
  const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  killer.on('exit', () => resolve());
  killer.on('error', () => resolve());
});

const waitPortFree = async (url, attempts = 80) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { await fetch(url); } catch { return; }
    await delay(150);
  }
  throw new Error(`Port still busy: ${url}`);
};

const evaluate = async (send, expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result.value;
};

const readJson = async (send, expression) => JSON.parse(await evaluate(send, expression) ?? 'null');

const clickAt = async (send, x, y) => {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
  }
  await delay(260);
};

/** Heat is a press-and-hold gesture: a zero-length click never activates it. */
const holdAt = async (send, x, y, ms = 520) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await delay(ms);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
  await delay(320);
};

/** Polls until a button with this exact label exists, so we never race the UI. */
const waitForText = async (send, text, timeoutMs = 6000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await evaluate(send, `[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(text)})`);
    if (found) return true;
    await delay(200);
  }
  return false;
};

/** Clicks a DOM control by its visible text, through real mouse events. */
const clickText = async (send, text) => {
  const rect = await readJson(send, `(() => {
    const node = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)});
    if (!node) return 'null';
    // The composer dialog scrolls internally, so a control can sit below the
    // fold; bring it into view before measuring, or the click lands elsewhere.
    node.scrollIntoView({ block: 'center' });
    const r = node.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width, h: r.height });
  })()`);
  if (!rect) return null;
  await clickAt(send, rect.x, rect.y);
  return rect;
};

const shot = async (send, file) => {
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(shots, file), Buffer.from(image.data, 'base64'));
};

const navigation = [];
const guidance = [];
const matrix = [];
let failures = 0;
const fail = (why) => { failures += 1; console.log(`FAIL: ${why}`); };

for (const viewport of viewports) {
  for (const broken of viewport.reduced ? [false] : [false, true]) {
    const label = `${viewport.width}x${viewport.height}${viewport.reduced ? '-reduced' : ''}${broken ? '-broken' : ''}`;
    const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', 'vite.local.config.ts'], {
      cwd: root,
      env: {
        ...process.env, MURMUR_LOCAL_SENSOR: 'heat', MURMUR_LOCAL_EXPEDITION_STATE: 'open',
        MURMUR_LOCAL_BAD_COMMENTS_URL: broken ? '1' : '0',
      },
      stdio: 'ignore',
    });
    rmSync(profile, { recursive: true, force: true });
    const chrome = spawn(chromePath, [
      '--headless=new', '--remote-debugging-port=9228', `--user-data-dir=${profile}`,
      '--no-first-run', '--disable-background-networking', '--hide-scrollbars', 'about:blank',
    ], { stdio: 'ignore' });

    try {
      await waitFor('http://127.0.0.1:4173/api/health');
      await waitFor('http://127.0.0.1:9228/json/version');
      const { socket, send } = await connect();
      await send('Page.enable'); await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 768 });
      if (viewport.reduced) await send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await send('Page.navigate', { url: 'http://127.0.0.1:4173/game.html' });
      await delay(3000);

      if (!broken) {
        // --- Guidance: it must still be there long after any old 1.8s timer ---
        await delay(2600);
        let g = await readJson(send, 'JSON.stringify(window.__murmurGuidance ?? null)');
        const introHeld = g?.introVisible === true && g?.activationsUsed === 0;
        if (!introHeld) fail(`${label}: intro guidance vanished before interaction`);
        if (!viewport.reduced && viewport.width === 360) await shot(send, '360x800-heat-instructions.png');
        guidance.push({ viewport: label, phase: 'before-interaction', introVisible: g?.introVisible, guidance: g?.guidance, activationsUsed: g?.activationsUsed, heldAfterTimer: introHeld });

        // First activation compacts it. Heat is press-and-hold, and it ignores a
        // gesture that starts over an interactive object (Murmur sits at the
        // world centre), so hold on empty cavern to the side.
        await holdAt(send, Math.round(viewport.width * 0.2), Math.round(viewport.height * 0.3));
        await delay(500);
        g = await readJson(send, 'JSON.stringify(window.__murmurGuidance ?? null)');
        const compacted = g?.activationsUsed >= 1 && g?.introVisible === false && /1 of 3/.test(g?.guidance ?? '');
        if (!compacted) fail(`${label}: first activation did not compact guidance (${g?.guidance})`);
        if (!viewport.reduced && viewport.width === 360) await shot(send, '360x800-heat-progress.png');
        guidance.push({ viewport: label, phase: 'after-first-activation', introVisible: g?.introVisible, guidance: g?.guidance, activationsUsed: g?.activationsUsed, compacted });

        // HOW TO SENSE is a Phaser control, so it is clicked at its reported
        // centre rather than found in the DOM.
        const helpRect = g?.howToSense;
        if (!helpRect?.visible) fail(`${label}: HOW TO SENSE not available`);
        else await clickAt(send, helpRect.x, helpRect.y);
        g = await readJson(send, 'JSON.stringify(window.__murmurGuidance ?? null)');
        const helpRestored = g?.helpOpen === true && g?.introVisible === true;
        if (!helpRestored) fail(`${label}: HOW TO SENSE did not restore help`);
        if (!viewport.reduced && viewport.width === 360) await shot(send, '360x800-how-to-sense.png');
        guidance.push({ viewport: label, phase: 'how-to-sense', helpOpen: g?.helpOpen, restored: helpRestored, target: helpRect ?? null });
        if (g?.howToSense?.visible) await clickAt(send, g.howToSense.x, g.howToSense.y);
        g = await readJson(send, 'JSON.stringify(window.__murmurGuidance ?? null)');
        if (g?.helpOpen !== false) fail(`${label}: help did not close`);
      }

      // --- Fallback navigation: vote, share, preview, copy, open comments ---
      await evaluate(send, `fetch('/api/round/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({direction:'south',requestId:'harness_req_0001'})})`);
      await delay(600);
      await evaluate(send, `window.dispatchEvent(new CustomEvent('murmur:community-updated'))`);
      if (!(await waitForText(send, 'SHARE WHAT YOU SENSED'))) fail(`${label}: SHARE WHAT YOU SENSED never appeared`);
      const opened = Boolean(await clickText(send, 'SHARE WHAT YOU SENSED'));
      if (!opened) fail(`${label}: SHARE WHAT YOU SENSED not clickable`);
      if (!(await waitForText(send, 'PREVIEW'))) fail(`${label}: composer did not open`);
      // Compose: pick the first observation, a direction and a confidence.
      await evaluate(send, `(() => {
        const pick = (name, value) => { const el = document.querySelector('input[name="'+name+'"][value="'+value+'"]'); if (el) { el.click(); } };
        pick('fn-observation', 'moving-warmth'); pick('fn-direction', 'south'); pick('fn-confidence', 'medium');
        const ta = document.querySelector('.fn-textarea'); if (ta) { ta.value = 'The signal felt stronger beyond this passage.'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      })()`);
      await delay(200);
      await clickText(send, 'PREVIEW');
      if (!(await waitForText(send, 'OPEN COMMENTS'))) fail(`${label}: preview did not render`);
      const bodyText = await evaluate(send, `(document.querySelector('.fn-body')?.textContent ?? '')`);
      const previewShown = bodyText.includes('HEAT FIELD NOTE · SOUTH') && bodyText.includes('Medium confidence');
      if (!previewShown) fail(`${label}: preview body wrong: ${bodyText.slice(0, 60)}`);
      if (!broken && viewport.width === 360 && !viewport.reduced) await shot(send, '360x800-field-note-preview.png');
      if (!broken && viewport.width === 1280) await shot(send, '1280x720-field-note-preview.png');

      // OPEN COMMENTS must invoke the navigation abstraction exactly once.
      const navRect = await clickText(send, 'OPEN COMMENTS');
      if (!navRect) fail(`${label}: OPEN COMMENTS not present`);
      if (navRect && (navRect.w < 44 || navRect.h < 44)) fail(`${label}: OPEN COMMENTS target below 44x44`);
      let nav = await readJson(send, 'JSON.stringify(window.__murmurNavigation ?? null)');
      const invokedOnce = nav?.count === 1;
      if (!invokedOnce) fail(`${label}: navigation invoked ${nav?.count} times`);

      let errorShown = false;
      let linkCopied = null;
      if (broken) {
        errorShown = await evaluate(send, `!!document.querySelector('.fn-error')`);
        if (!errorShown) fail(`${label}: navigation error state not shown`);
        if (viewport.width === 360 && !viewport.reduced) await shot(send, '360x800-navigation-error.png');
        // COPY COMMENTS LINK must be offered and carry the destination.
        const copyRect = await clickText(send, 'COPY COMMENTS LINK');
        if (!copyRect) fail(`${label}: COPY COMMENTS LINK missing`);
        linkCopied = await evaluate(send, `(document.querySelector('.fn-status')?.textContent ?? '')`);
        // TRY AGAIN clears the error and re-attempts.
        await clickText(send, 'TRY AGAIN');
        const cleared = await evaluate(send, `!document.querySelector('.fn-error')`);
        if (!cleared) fail(`${label}: TRY AGAIN did not clear the error`);
      } else {
        // A double tap must not navigate twice.
        await clickText(send, 'OPEN COMMENTS');
        nav = await readJson(send, 'JSON.stringify(window.__murmurNavigation ?? null)');
        if (nav?.count !== 2) fail(`${label}: second explicit click should be a second request (got ${nav?.count})`);
      }

      const published = await evaluate(send, `/published|shared/i.test(document.querySelector('.fn-status')?.textContent ?? '')`);
      if (published) fail(`${label}: fallback claimed publication`);

      const doc = await readJson(send, `JSON.stringify([document.documentElement.scrollWidth, document.documentElement.scrollHeight])`);
      const noScroll = doc[0] === viewport.width && doc[1] === viewport.height;
      if (!noScroll) fail(`${label}: internal scroll ${doc}`);

      navigation.push({
        viewport: label, brokenDestination: broken, previewShown,
        navigationInvokedOnce: invokedOnce, lastUrl: nav?.lastUrl ?? null, outcome: nav?.lastOutcome ?? null,
        errorStateShown: errorShown, copyStatus: linkCopied, claimedPublication: published,
        targetSize: navRect ? [Math.round(navRect.w), Math.round(navRect.h)] : null,
      });
      matrix.push({ viewport: label, reducedMotion: viewport.reduced, brokenDestination: broken, noInternalScroll: noScroll });

      socket.close();
    } finally {
      terminate(chrome); terminate(vite);
      await killTree(chrome.pid); await killTree(vite.pid);
      // Never start the next case until this one's servers are really gone.
      await waitPortFree('http://127.0.0.1:4173/api/health');
      await waitPortFree('http://127.0.0.1:9228/json/version');
      await delay(400);
    }
  }
}

const write = (name, value) => writeFileSync(join(raw, name), `${JSON.stringify(value, null, 2)}\n`);
write('navigation-results.json', { method: 'chrome headless + CDP real clicks', failures, passed: failures === 0, cases: navigation });
write('instruction-lifecycle.json', { method: 'chrome headless + CDP real clicks', failures, passed: failures === 0, cases: guidance });
write('visual-matrix.json', { capturedAt: new Date().toISOString().slice(0, 10), failures, passed: failures === 0, cases: matrix });
rmSync(profile, { recursive: true, force: true });
console.log(`guidance/navigation matrix complete: ${navigation.length} navigation cases, ${guidance.length} guidance cases, ${failures} failures`);
if (failures > 0) process.exitCode = 1;
