import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const evidenceRoot = join(root, 'evidence', 'private-senses');
const screenshotRoot = join(evidenceRoot, 'screenshots');
const rawRoot = join(evidenceRoot, 'raw');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewports = [
  [360, 800],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1280, 720],
];
const evidenceViewports = new Set(['360x800', '390x844', '1280x720']);
const reducedMotionAudit = process.argv.includes('--reduced');
const selectedViewports = reducedMotionAudit ? [[360, 800]] : viewports;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

mkdirSync(screenshotRoot, { recursive: true });
mkdirSync(rawRoot, { recursive: true });

const waitFor = async (url, attempts = 80) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const connectCdp = async () => {
  const targets = await (await fetch('http://127.0.0.1:9225/json/list')).json();
  const target = targets.find((candidate) => candidate.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('Chrome page target unavailable');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let messageId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    messageId += 1;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  return { socket, send };
};

const mouseClick = async (send, x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

const touchClick = async (send, x, y) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const activate = async (send, sensor, x, y, touch) => {
  if (sensor === 'echo') {
    if (touch) await touchClick(send, x, y);
    else await mouseClick(send, x, y);
  } else if (sensor === 'heat') {
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await delay(120);
      await delay(590);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await delay(590);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
  } else {
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await delay(120);
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 74, y: y + 14, id: 1 }] });
      await delay(120);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 74, y: y + 14, button: 'left', buttons: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 74, y: y + 14, button: 'left', clickCount: 1 });
    }
  }
  await delay(320);
};

const terminate = (child) => {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
};

const matrix = [];
const requestedSensors = process.argv.slice(2).filter((sensor) => sensor === 'echo' || sensor === 'heat' || sensor === 'wind');
for (const sensor of requestedSensors.length > 0 ? requestedSensors : ['echo', 'heat', 'wind']) {
  const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', 'vite.local.config.ts'], {
    cwd: root,
    env: { ...process.env, MURMUR_LOCAL_SENSOR: sensor },
    stdio: 'ignore',
  });
  const profile = join(root, '.tmp-private-sense-chrome');
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-background-networking',
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitFor('http://127.0.0.1:4173/api/health');
    await waitFor('http://127.0.0.1:9225/json/version');
    const { socket, send } = await connectCdp();
    await send('Page.enable');
    await send('Runtime.enable');
    if (reducedMotionAudit) {
      await send('Emulation.setEmulatedMedia', {
        media: '',
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
    }
    for (const [width, height] of selectedViewports) {
      await fetch('http://127.0.0.1:4173/api/local-reset', { method: 'POST' });
      const touch = width < 768;
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
      await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 1 });
      await send('Page.navigate', { url: 'http://127.0.0.1:4173/game.html' });
      await delay(2600);
      const centerX = width / 2;
      const isWide = width / height >= 1.35;
      const density = isWide ? 'wide' : width >= 700 ? 'spacious' : (width <= 390 || height <= 760) ? 'compact' : 'balanced';
      const headerHeight = isWide ? 106 : density === 'spacious' ? 124 : density === 'compact' ? 112 : 120;
      const actionHeight = isWide ? 132 : density === 'spacious' ? 190 : density === 'compact' ? 180 : 186;
      const worldHeight = height - actionHeight - headerHeight;
      const centerY = headerHeight + worldHeight * 0.46;
      for (let activation = 0; activation < 4; activation += 1) {
        const activationX = sensor === 'wind' ? centerX + 65 : centerX + 42 + activation * 7;
        await activate(send, sensor, activationX, centerY - 12 + activation * 8, touch);
      }
      const viewportKey = `${width}x${height}`;
      if (evidenceViewports.has(viewportKey)) {
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const suffix = reducedMotionAudit ? '-reduced' : '';
        writeFileSync(join(screenshotRoot, `${viewportKey}-${sensor}${suffix}.png`), Buffer.from(shot.data, 'base64'));
      }
      const actionOffset = width <= 390 ? 72 : 76;
      const eastX = width - Math.max(48, Math.min(isWide ? 116 : 78, width * 0.13));
      const eastY = centerY - (isWide ? 18 : 24);
      if (touch) await touchClick(send, eastX, eastY); else await mouseClick(send, eastX, eastY);
      await delay(1050);
      const confirmX = centerX - actionOffset;
      const confirmY = height - 47;
      if (touch) await touchClick(send, confirmX, confirmY); else await mouseClick(send, confirmX, confirmY);
      await delay(500);
      const dimensions = await send('Runtime.evaluate', {
        expression: `JSON.stringify({inner:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],canvas:(()=>{const c=document.querySelector('canvas');return c?[c.clientWidth,c.clientHeight]:null})(),scroll:[scrollX,scrollY]})`,
        returnByValue: true,
      });
      const session = await (await fetch('http://127.0.0.1:4173/api/session')).json();
      matrix.push({
        sensor,
        viewport: viewportKey,
        input: touch ? 'touch' : 'mouse',
        activations: 3,
        selectedDirection: 'east',
        persistedVote: session.round.currentVote,
        aggregateTotal: session.round.counts.total,
        dimensions: JSON.parse(dimensions.result.value),
        noInternalScroll: JSON.parse(dimensions.result.value).document[0] === width && JSON.parse(dimensions.result.value).document[1] === height,
      });
    }
    socket.close();
  } finally {
    terminate(chrome);
    terminate(vite);
    await delay(700);
  }
}

const matrixPath = join(rawRoot, reducedMotionAudit ? 'reduced-motion.json' : 'visual-matrix.json');
if (reducedMotionAudit) {
  writeFileSync(matrixPath, `${JSON.stringify({ capturedAt: '2026-07-13', prefersReducedMotion: true, cases: matrix }, null, 2)}\n`, 'utf8');
  process.exit(0);
}
let previousCases = [];
try {
  previousCases = JSON.parse(await import('node:fs').then(({ readFileSync }) => readFileSync(matrixPath, 'utf8'))).cases ?? [];
} catch {}
const replacedSensors = new Set(requestedSensors.length > 0 ? requestedSensors : ['echo', 'heat', 'wind']);
const mergedCases = [...previousCases.filter((entry) => !replacedSensors.has(entry.sensor)), ...matrix]
  .sort((left, right) => `${left.sensor}-${left.viewport}`.localeCompare(`${right.sensor}-${right.viewport}`));
writeFileSync(matrixPath, `${JSON.stringify({ capturedAt: '2026-07-13', cases: mergedCases }, null, 2)}\n`, 'utf8');
