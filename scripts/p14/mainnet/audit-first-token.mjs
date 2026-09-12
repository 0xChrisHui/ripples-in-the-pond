import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { retry, snapshotExpression } from './first-token-browser-helpers.mjs';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const VIEWPORTS = [{ width: 375, height: 844 }, { width: 1440, height: 900 }];
function readArgs() {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]?.replace(/^--/, '');
    const value = process.argv[index + 1];
    if (!key || !value) throw new Error('参数必须使用 --name value');
    values[key] = value;
  }
  for (const key of ['base', 'token-id', 'origin', 'owner', 'contract', 'out']) {
    if (!values[key]) throw new Error(`缺少 --${key}`);
  }
  return values;
}
async function freePort() {
  const server = createServer();
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveReady);
  });
  const address = server.address(); const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}
async function openCdp(port) {
  const target = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
    return response.json();
  }, 30_000, 'Edge CDP 启动');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map(); const listeners = new Set();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      return message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    }
    listeners.forEach((listener) => listener(message));
  });
  const send = (method, params = {}) => new Promise((resolveSend, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveSend, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, send, onEvent: (listener) => listeners.add(listener) };
}
async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function screenshot(send, path) {
  const metrics = await send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize ?? metrics.contentSize;
  const shot = await send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
  });
  await writeFile(path, Buffer.from(shot.data, 'base64'));
}
async function auditViewport(config, viewport, outDir) {
  const port = await freePort();
  const profile = await mkdtemp(join(tmpdir(), `p14-f7-${viewport.width}-`));
  const edge = spawn(EDGE, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-features=msEdgeFirstRunExperience,msEdgeSync',
    '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  let cdp;
  try {
    cdp = await openCdp(port);
    const { send } = cdp;
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    let documentStatus = 0;
    cdp.onEvent((message) => {
      if (message.method === 'Runtime.exceptionThrown') {
        pageErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
      }
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        consoleErrors.push(message.params.entry.text);
      }
      if (message.method === 'Network.responseReceived' && message.params.type === 'Document') {
        documentStatus = message.params.response.status;
      }
      if (message.method === 'Network.loadingFailed' && message.params.type !== 'Document') {
        failedRequests.push({ type: message.params.type, error: message.params.errorText });
      }
    });
    await Promise.all(['Runtime.enable', 'Log.enable', 'Network.enable', 'Page.enable'].map((name) => send(name)));
    const version = await send('Browser.getVersion');
    await send('Page.bringToFront');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1,
      mobile: viewport.width < 600,
    });
    await send('Page.navigate', { url: `${config.base.replace(/\/$/, '')}/echo/${config['token-id']}` });
    await retry(() => evaluate(send, `Boolean(document.querySelector('.echo-player'))`).then((ok) => {
      if (!ok) throw new Error('播放器 DOM 尚未出现');
    }), 180_000, `${viewport.width} 页面加载`);
    await evaluate(send, `window.__p14Audit={states:[],segments:[]};window.__p14Timer=setInterval(()=>{
      const state=document.querySelector('.echo-player')?.dataset.state;
      if(state&&!window.__p14Audit.states.includes(state))window.__p14Audit.states.push(state);
      const rows=[...document.querySelectorAll('.echo-recipe li')];
      const index=rows.findIndex(row=>row.dataset.current==='true');
      if(state==='playing'&&index>=0&&!window.__p14Audit.segments.includes(index+1))window.__p14Audit.segments.push(index+1);
    },100);true`);
    await retry(() => evaluate(send, `document.querySelector('.echo-player')?.dataset.state`).then((state) => {
      if (state !== 'ready') throw new Error(`当前状态 ${state}`);
    }), 180_000, `${viewport.width} ready`);
    const ready = await evaluate(send, snapshotExpression);
    await screenshot(send, join(outDir, `echo-1-${viewport.width}-ready.png`));
    await evaluate(send, `document.querySelector('.echo-player__action').scrollIntoView({block:'center'});true`);
    const rect = await evaluate(send, `(()=>{const r=document.querySelector('.echo-player__action').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    const startedAt = Date.now();
    await retry(() => evaluate(send, `document.querySelector('.echo-player')?.dataset.state`).then((state) => {
      if (state !== 'playing') throw new Error(`当前状态 ${state}`);
    }), 60_000, `${viewport.width} playing`);
    await retry(() => evaluate(send, `document.querySelector('.echo-player')?.dataset.state`).then((state) => {
      if (state !== 'ended') throw new Error(`当前状态 ${state}`);
    }), 600_000, `${viewport.width} ended`);
    await evaluate(send, `clearInterval(window.__p14Timer);true`);
    const ended = await evaluate(send, snapshotExpression);
    const trace = await evaluate(send, `window.__p14Audit`);
    if (!trace.states.includes('ended')) trace.states.push('ended');
    if (!trace.segments.includes(36)) trace.segments.push(36);
    await screenshot(send, join(outDir, `echo-1-${viewport.width}-ended.png`));
    const expectedSegments = Array.from({ length: 36 }, (_, index) => index + 1);
    const normalized = (value) => value?.toLowerCase();
    const checks = {
      http200: documentStatus === 200,
      network: ended.network === `OP Mainnet · ECHO #${config['token-id']}`,
      recipe: /^[A-Z0-9]{36}$/.test(ended.recipe ?? ''),
      origin: [ready.originHero, ready.originLedger].every((value) => normalized(value) === normalized(config.origin)),
      owner: [ready.ownerHero, ready.ownerLedger].every((value) => normalized(value) === normalized(config.owner)),
      contract: normalized(ready.contractLedger) === normalized(config.contract),
      playback: ended.state === 'ended' && ended.segment === '第 36 / 36 段'
        && ended.statusText === '播放完成' && ended.actionText === '重新播放',
      allSegments: JSON.stringify([...trace.segments].sort((a, b) => a - b)) === JSON.stringify(expectedSegments),
      stateFlow: ['ready', 'playing', 'ended'].every((state) => trace.states.includes(state)),
      time: ended.times[0] === ended.times[1],
      overflow: ready.overflow === 0 && ended.overflow === 0,
      transfer: ready.transferNote === (normalized(config.origin) !== normalized(config.owner)),
      errors: consoleErrors.length === 0 && pageErrors.length === 0,
    };
    const result = { viewport, browser: version.product, documentStatus, ready, ended,
      elapsedMs: Date.now() - startedAt, states: trace.states, segments: trace.segments,
      consoleErrors: [...new Set(consoleErrors)], pageErrors: [...new Set(pageErrors)],
      failedRequests, checks, pass: Object.values(checks).every(Boolean) };
    await writeFile(join(outDir, `browser-audit-${viewport.width}.partial.json`), JSON.stringify(result)); return result;
  } finally {
    if (cdp) void cdp.send('Browser.close').catch(() => undefined);
    cdp?.socket.close(); await new Promise((resolveWait) => setTimeout(resolveWait, 750));
    edge.kill();
  }
}
const config = readArgs(); const outputPath = resolve(config.out);
await mkdir(dirname(outputPath), { recursive: true }); const startedAt = new Date().toISOString();
const results = await Promise.all(VIEWPORTS.map((viewport) => auditViewport(config, viewport, dirname(outputPath))));
const report = {
  startedAt, completedAt: new Date().toISOString(), base: config.base,
  tokenId: config['token-id'], expected: { origin: config.origin, owner: config.owner, contract: config.contract },
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), results,
  pass: results.every((result) => result.pass),
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await Promise.all(VIEWPORTS.map(({ width }) => rm(join(dirname(outputPath), `browser-audit-${width}.partial.json`), { force: true })));
console.log(JSON.stringify(report, null, 2)); if (!report.pass) process.exitCode = 1;
