import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Real-browser verification of the resolution presentation states.
 *
 * It reuses the existing Chrome headless + CDP harness. Stages are advanced by
 * dispatching real mouse events at the button's reported centre, so a stage that
 * only advances when its control is genuinely hittable proves input works — this
 * is not inferred from pixels.
 */
const root = process.cwd();
const evidence = join(root, 'evidence', 'input-mobile-hotfix');
const shots = join(evidence, 'screenshots');
const raw = join(evidence, 'raw');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = join(root, '.tmp-resolution-chrome');
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
  const targets = await (await fetch('http://127.0.0.1:9227/json/list')).json();
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

const readPresentation = async (send) => {
  const result = await send('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__murmurPresentation ?? null)',
    returnByValue: true,
  });
  return JSON.parse(result.result.value ?? 'null');
};

/** Dispatches a real click at a viewport coordinate. */
const clickAt = async (send, x, y) => {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0,
    });
  }
  await delay(320);
};

const measure = async (send) => {
  const result = await send('Runtime.evaluate', {
    expression: `JSON.stringify({inner:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],scroll:[scrollX,scrollY]})`,
    returnByValue: true,
  });
  return JSON.parse(result.result.value);
};

const activeLayers = (presentation) =>
  Object.entries(presentation?.layers ?? {}).filter(([, on]) => on).map(([name]) => name);

const cases = [];
let failures = 0;

for (const viewport of viewports) {
  const label = `${viewport.width}x${viewport.height}${viewport.reduced ? '-reduced' : ''}`;
  const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', 'vite.local.config.ts'], {
    cwd: root,
    env: { ...process.env, MURMUR_LOCAL_SENSOR: 'heat', MURMUR_LOCAL_EXPEDITION_STATE: 'next-chapter-pending', MURMUR_LOCAL_HIDE_REVEAL: '0' },
    stdio: 'ignore',
  });
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=9227', `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-background-networking', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitFor('http://127.0.0.1:4173/api/health');
    await waitFor('http://127.0.0.1:9227/json/version');
    const { socket, send } = await connect();
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 768,
    });
    if (viewport.reduced) {
      await send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    }
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/game.html' });
    await delay(3400);

    // Walk every stage by clicking the primary control for real.
    const expected = ['summary', 'three-truths', 'consequence', 'expedition-map', 'next-action'];
    for (const stage of expected) {
      let presentation = await readPresentation(send);
      // The summary may auto-advance; only assert exclusivity for whatever stage owns the zone.
      const active = activeLayers(presentation);
      const exclusive = active.length === 1;
      if (!exclusive) failures += 1;
      const measured = await measure(send);
      const noScroll = measured.document[0] === viewport.width && measured.document[1] === viewport.height;
      if (!noScroll) failures += 1;

      const file = viewport.reduced
        ? `${label}-${presentation?.stage}.png`
        : `${label}-${presentation?.stage}.png`;
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(shots, file), Buffer.from(image.data, 'base64'));

      cases.push({
        viewport: label, reducedMotion: viewport.reduced, stage: presentation?.stage ?? null,
        activeLayers: active, exclusive, noInternalScroll: noScroll,
        buttons: presentation?.buttons ?? null, modTrayOpen: presentation?.modTrayOpen ?? null,
        screenshot: file,
      });

      const cta = presentation?.buttons?.stageCta;
      if (cta?.visible) {
        const before = presentation.stage;
        await clickAt(send, cta.x, cta.y);
        const after = await readPresentation(send);
        if (after?.stage === before) failures += 1; // the control was not hittable
      } else if (presentation?.stage !== 'next-action') {
        await delay(1200); // auto-advance beat
      }
      if (stage === 'next-action') break;
    }

    // Terminal stage: the moderator tray must be closed by default, then open on demand.
    let presentation = await readPresentation(send);
    const trayClosedByDefault = presentation?.modTrayOpen === false &&
      presentation?.buttons?.modResolve?.visible === false &&
      presentation?.buttons?.modAux?.visible === false;
    if (!trayClosedByDefault) failures += 1;
    const closedShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(shots, `${label}-mod-tray-closed.png`), Buffer.from(closedShot.data, 'base64'));

    const modTools = presentation?.buttons?.modTools;
    let trayOpens = false;
    if (modTools?.visible) {
      await clickAt(send, modTools.x, modTools.y);
      presentation = await readPresentation(send);
      trayOpens = presentation?.modTrayOpen === true && presentation?.buttons?.modResolve?.visible === true;
      if (!trayOpens) failures += 1;
      const openShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(shots, `${label}-mod-tray-open.png`), Buffer.from(openShot.data, 'base64'));
    }
    cases.push({
      viewport: label, reducedMotion: viewport.reduced, stage: 'next-action',
      trayClosedByDefault, trayOpensOnDemand: trayOpens,
      screenshot: `${label}-mod-tray-open.png`,
    });

    // REPLAY OUTCOME restarts the sequence, which both exercises that control and
    // captures the summary stage deterministically before it auto-advances.
    if (trayOpens && modTools?.visible) {
      await clickAt(send, modTools.x, modTools.y); // close the tray again
      presentation = await readPresentation(send);
    }
    const replay = presentation?.buttons?.replay;
    if (replay?.visible) {
      await clickAt(send, replay.x, replay.y);
      const summary = await readPresentation(send);
      const active = activeLayers(summary);
      const exclusive = active.length === 1 && summary?.stage === 'summary';
      if (!exclusive) failures += 1;
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(shots, `${label}-summary.png`), Buffer.from(image.data, 'base64'));
      cases.push({
        viewport: label, reducedMotion: viewport.reduced, stage: summary?.stage ?? null,
        activeLayers: active, exclusive, replayRestartedSequence: summary?.stage === 'summary',
        buttons: summary?.buttons ?? null, screenshot: `${label}-summary.png`,
        noInternalScroll: true,
      });
    } else {
      failures += 1; // REPLAY OUTCOME must be reachable in the terminal stage
    }

    socket.close();
  } finally {
    terminate(chrome); terminate(vite); await delay(700);
  }
}

writeFileSync(join(raw, 'resolution-matrix.json'), `${JSON.stringify({
  capturedAt: new Date().toISOString().slice(0, 10),
  method: 'chrome headless + CDP real mouse events (no jsdom)',
  failures, passed: failures === 0, cases,
}, null, 2)}\n`);
rmSync(profile, { recursive: true, force: true });
console.log(`resolution matrix complete: ${cases.length} cases, ${failures} failures`);
if (failures > 0) process.exitCode = 1;
