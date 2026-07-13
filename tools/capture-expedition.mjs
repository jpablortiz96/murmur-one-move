import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const evidence = join(root, 'evidence', 'expedition-engine');
const shots = join(evidence, 'screenshots');
const raw = join(evidence, 'raw');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = join(root, '.tmp-expedition-chrome');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(shots, { recursive: true });
mkdirSync(raw, { recursive: true });

const cases = [
  { file: '360x800-expedition-map.png', width: 360, height: 800, state: 'open', wait: 4200, hideReveal: true },
  { file: '360x800-resolving.png', width: 360, height: 800, state: 'resolving', wait: 3200, hideReveal: true },
  { file: '360x800-three-truths.png', width: 360, height: 800, state: 'next-chapter-pending', wait: 2500 },
  { file: '360x800-consequence.png', width: 360, height: 800, state: 'next-chapter-pending', wait: 3200 },
  { file: '360x800-next-chapter.png', width: 360, height: 800, state: 'next-chapter-pending', wait: 3200, hideReveal: true },
  { file: '390x844-completed.png', width: 390, height: 844, state: 'completed', wait: 3200 },
  { file: null, width: 412, height: 915, state: 'next-chapter-pending', wait: 3200 },
  { file: null, width: 768, height: 1024, state: 'next-chapter-pending', wait: 3200 },
  { file: '1280x720-three-truths.png', width: 1280, height: 720, state: 'next-chapter-pending', wait: 2500 },
  { file: null, width: 360, height: 800, state: 'next-chapter-pending', wait: 2600, reduced: true },
];

const waitFor = async (url, attempts = 100) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const connect = async () => {
  const targets = await (await fetch('http://127.0.0.1:9226/json/list')).json();
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
const matrix = [];

for (const item of cases) {
  const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', 'vite.local.config.ts'], {
    cwd: root,
    env: {
      ...process.env,
      MURMUR_LOCAL_SENSOR: 'heat',
      MURMUR_LOCAL_EXPEDITION_STATE: item.state,
      MURMUR_LOCAL_HIDE_REVEAL: item.hideReveal ? '1' : '0',
    },
    stdio: 'ignore',
  });
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=9226', `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-background-networking', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitFor('http://127.0.0.1:4173/api/health');
    await waitFor('http://127.0.0.1:9226/json/version');
    const { socket, send } = await connect();
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: item.width, height: item.height, deviceScaleFactor: 1, mobile: item.width < 768,
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: item.width < 768, maxTouchPoints: 1 });
    if (item.reduced) await send('Emulation.setEmulatedMedia', {
      media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/game.html' });
    await delay(item.wait);
    const dimensions = await send('Runtime.evaluate', {
      expression: `JSON.stringify({inner:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],canvas:(()=>{const c=document.querySelector('canvas');return c?[c.clientWidth,c.clientHeight]:null})(),scroll:[scrollX,scrollY]})`,
      returnByValue: true,
    });
    const measured = JSON.parse(dimensions.result.value);
    if (item.file) {
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(shots, item.file), Buffer.from(image.data, 'base64'));
    }
    matrix.push({
      state: item.state, viewport: `${item.width}x${item.height}`,
      reducedMotion: Boolean(item.reduced), screenshot: item.file,
      dimensions: measured,
      noInternalScroll: measured.document[0] === item.width && measured.document[1] === item.height,
      touchTargets: item.width < 768 ? 'touch' : 'mouse',
    });
    socket.close();
  } finally {
    terminate(chrome); terminate(vite); await delay(700);
  }
}

writeFileSync(join(raw, 'visual-matrix.json'), `${JSON.stringify({ capturedAt: '2026-07-13', cases: matrix }, null, 2)}\n`);
rmSync(profile, { recursive: true, force: true });
