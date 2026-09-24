import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile = path.resolve('.edge-i2-profile');
const output = path.resolve('reviews/evidence/p11-i/i2-continuity.json');
const browser = spawn(edge, [
  '--headless=new', '--no-first-run', '--disable-features=msEdgeFirstRunExperience',
  '--remote-debugging-port=9223', `--user-data-dir=${profile}`,
  '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function endpoint() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9223/json/version');
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error('Edge CDP did not start');
}

let socket;
try {
  await endpoint();
  const targetResponse = await fetch(
    `http://127.0.0.1:9223/json/new?${encodeURIComponent('http://localhost:3000/')}`,
    { method: 'PUT' },
  );
  const target = await targetResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, label, timeout = 45_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await delay(200);
    }
    throw new Error(`timeout: ${label}`);
  };
  const load = async (pathname) => {
    await send('Page.navigate', { url: `http://localhost:3000${pathname}` });
    await until(`location.pathname === ${JSON.stringify(pathname.split('?')[0])}
      && Boolean(document.querySelector('[data-pond-mount-id]'))
      && Boolean(document.querySelector('canvas'))`, `load ${pathname}`);
  };
  const snapshot = (label) => evaluate(`(() => {
    const shell = document.querySelector('[data-pond-mount-id]');
    const canvas = document.querySelector('canvas');
    return {
      label: ${JSON.stringify(label)},
      path: location.pathname,
      mountId: shell?.dataset.pondMountId ?? null,
      owner: shell?.dataset.pondSceneOwner ?? null,
      sameShell: shell === window.__p11Shell,
      sameCanvas: canvas === window.__p11Canvas,
      canvasCount: document.querySelectorAll('canvas').length,
      glHealth: document.querySelector('[data-pond-root]')?.dataset.glHealth ?? null,
    };
  })()`);
  const click = async (href) => {
    const clicked = await evaluate(`(() => {
      const link = [...document.querySelectorAll('a')].find((node) => node.getAttribute('href') === ${JSON.stringify(href)});
      if (!link) return false;
      link.click();
      return true;
    })()`);
    if (!clicked) throw new Error(`link missing: ${href}`);
    await until(`location.pathname === ${JSON.stringify(href.split('#')[0])}`, `click ${href}`);
    await delay(700);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await load('/');
  await until(`document.querySelector('[data-pond-root]')?.dataset.glHealth !== 'unavailable'`, 'initial GL health');
  await evaluate(`window.__p11Shell = document.querySelector('[data-pond-mount-id]');
    window.__p11Canvas = document.querySelector('canvas'); true`);
  const initial = await snapshot('initial');
  const loops = [];
  for (let index = 0; index < 3; index += 1) {
    await click('/me#pond-echoes');
    loops.push(await snapshot(`me-${index + 1}`));
    await click('/');
    loops.push(await snapshot(`home-${index + 1}`));
  }

  await load('/me');
  const directMe = await snapshot('direct-me');
  await send('Page.reload');
  await until(`location.pathname === '/me'
    && document.readyState === 'complete'
    && document.querySelector('[data-pond-mount-id]')?.dataset.pondMountId !== ${JSON.stringify(directMe.mountId)}
    && Boolean(document.querySelector('canvas'))`, 'refresh /me');
  const refreshMe = await snapshot('refresh-me');

  await load('/?forceFallback=1');
  await click('/me#pond-echoes');
  await until(`document.querySelector('[data-pond-root]')?.dataset.glHealth === 'forced'`, 'fallback health');
  const fallbackMe = await snapshot('fallback-me');

  const passed = loops.every((item) => item.sameShell && item.sameCanvas && item.canvasCount <= 2)
    && directMe.path === '/me' && directMe.canvasCount > 0
    && refreshMe.path === '/me' && refreshMe.canvasCount > 0
    && fallbackMe.path === '/me' && fallbackMe.glHealth === 'forced';
  const result = { passed, initial, loops, directMe, refreshMe, fallbackMe };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  if (!passed) throw new Error(`I2 continuity failed: ${output}`);
  console.log(`I2 continuity passed: ${output}`);
} finally {
  socket?.close();
  browser.kill();
}
