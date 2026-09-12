import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.P14_APP ?? 'http://localhost:3014/';
const CDP = process.env.P14_CDP ?? 'http://localhost:9336';
const OUT = path.resolve('reviews/evidence/p14-g6-track36');
const REGULAR = 'button[aria-pressed]:not([data-featured-echo-hit])';
const ECHO = '[data-featured-echo-hit]';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const FEATURED = { echo: { kind: 'pond-echo', chainId: 10, contractAddress: `0x${'3'.repeat(40)}`, tokenId: '1',
  identity: `eip155:10:0x${'3'.repeat(40)}:1`, playbackId: `pond-echo:eip155:10:0x${'3'.repeat(40)}:1`, title: 'Pond Echo #1', href: '/echo/1',
  recipe: 'A'.repeat(36), clips: { A: { uri: `ar://${'A'.repeat(43)}`, sha256: 'b'.repeat(64), durationMs: 7_050 } }, durationMs: 253_800 } };

class Client {
  constructor(url) {
    this.id = 0; this.jobs = new Map(); this.errors = []; this.warnings = [];
    this.mutations = []; this.mockFeatured = 'success'; this.ws = new WebSocket(url);
  }
  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP 连接超时')), 8_000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
      this.ws.addEventListener('message', (event) => this.onMessage(JSON.parse(event.data)));
    });
  }
  onMessage(message) {
    if (!message.id) {
      const p = message.params;
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(p.exceptionDetails?.text ?? 'exception');
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) {
        const line = p.args.map((arg) => arg.value ?? arg.description).join(' ');
        if (p.type === 'error' && !line.startsWith('Error checking Cross-Origin-Opener-Policy')) this.errors.push(line);
        else this.warnings.push(line);
      }
      if (message.method === 'Network.requestWillBeSent'
        && p.request.url.startsWith(APP) && !['GET', 'HEAD', 'OPTIONS'].includes(p.request.method)) {
        this.mutations.push({ method: p.request.method, url: p.request.url });
      }
      if (message.method === 'Fetch.requestPaused') {
        const mock = p.request.url.includes('/api/echo/featured') ? this.mockFeatured : null;
        const args = mock
          ? { requestId: p.requestId, responseCode: mock === 'failure' ? 503 : 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
            body: Buffer.from(JSON.stringify(mock === 'failure' ? { error: 'unavailable' } : FEATURED)).toString('base64') }
          : { requestId: p.requestId };
        void this.send(mock ? 'Fetch.fulfillRequest' : 'Fetch.continueRequest', args);
      }
      return;
    }
    const job = this.jobs.get(message.id); if (!job) return;
    this.jobs.delete(message.id);
    if (message.error) job.reject(new Error(message.error.message));
    else job.resolve(message.result);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.jobs.delete(id); reject(new Error(`${method} 超时`)); }, 20_000);
      this.jobs.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function evaluate(cdp, expression) {
  const out = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.text);
  return out.result.value;
}
async function waitFor(cdp, expression, label, timeout = 45_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(cdp, expression)) return; await sleep(150); }
  throw new Error(`等待失败：${label}`);
}
async function shot(cdp, name) {
  const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(path.join(OUT, name), Buffer.from(image.data, 'base64'));
}
async function metrics(cdp, width, height, reduced = false) {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ] });
}
async function go(cdp, url) {
  await cdp.send('Page.navigate', { url });
  await waitFor(cdp, `location.href==='${url}'&&document.readyState==='complete'`, url, 60_000);
}
async function waitForPond(cdp, featured) {
  await waitFor(cdp,
    `document.querySelectorAll('${REGULAR}').length===35&&document.querySelectorAll('${ECHO}').length===${featured}`,
    `35+${featured}`, 120_000);
}
async function waitForEcho(cdp, mode = 'webgl') {
  await waitFor(cdp, `(()=>{const e=document.querySelector('${ECHO}');if(!e)return false;const r=e.getBoundingClientRect();return e.dataset.echoRenderMode==='${mode}'&&getComputedStyle(e).pointerEvents==='auto'&&r.width>=44&&r.height>=44&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight})()`, `ECHO ${mode}`);
}
async function switchGroup(cdp, index, badge, featured) {
  const buttons = `([...document.querySelectorAll('nav button')].filter((b)=>/^[123]${badge}$/.test(b.textContent.replace(/\\s/g,''))))`;
  await waitFor(cdp, `${buttons}.length===3`, `导航 badge ${badge}`);
  await evaluate(cdp, `${buttons}[${index}].click()`); await sleep(500); await waitForPond(cdp, featured);
  return evaluate(cdp, `${buttons}[${index}].className.includes('bg-white/5')`);
}
async function key(cdp, keyValue, code) {
  const virtualKey = code === 'Enter' ? 13 : 32;
  const text = code === 'Enter' ? '\r' : ' ';
  const common = { key: keyValue, code, windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey, text, unmodifiedText: text };
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...common });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
}
async function stopEcho(cdp) {
  await waitFor(cdp, `!!document.querySelector('[data-featured-echo-player]')`, 'ECHO 控制条');
  await evaluate(cdp, `[...document.querySelectorAll('[data-featured-echo-player] button')].find((b)=>b.textContent==='停止').click()`);
  await waitFor(cdp, `!document.querySelector('[data-featured-echo-player]')`, 'ECHO 停止');
}

const targets = await (await fetch(`${CDP}/json/list`)).json();
const target = targets.find((item) => item.type === 'page' && item.url.startsWith(APP));
assert.ok(target?.webSocketDebuggerUrl, '未找到本地首页 Edge target');
const cdp = new Client(target.webSocketDebuggerUrl);
const result = {};

try {
  await cdp.open();
  for (const domain of ['Page', 'Runtime', 'Network']) await cdp.send(`${domain}.enable`);
  await cdp.send('Page.bringToFront');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*api/echo/featured*', requestStage: 'Request' }] });

  await metrics(cdp, 1440, 1000);
  await go(cdp, `${APP}?g6=baseline`); await waitForPond(cdp, 1);
  cdp.errors = []; cdp.warnings = []; cdp.mutations = [];
  cdp.mockFeatured = 'failure';
  await go(cdp, `${APP}?g6=no-featured`); await waitForPond(cdp, 0);
  result.noFeatured = await evaluate(cdp, `({regular:document.querySelectorAll('${REGULAR}').length,featured:document.querySelectorAll('${ECHO}').length,overflow:document.documentElement.scrollWidth>innerWidth})`);
  assert.deepEqual(result.noFeatured, { regular: 35, featured: 0, overflow: false });
  result.noFeatured.groups = [await switchGroup(cdp, 1, 35, 0), await switchGroup(cdp, 2, 35, 0)];
  assert.deepEqual(result.noFeatured.groups, [true, true]);
  await shot(cdp, 'smoke-no-featured-35+0.png');
  cdp.mockFeatured = 'success';

  await metrics(cdp, 768, 1024); await go(cdp, APP); await waitForPond(cdp, 1); await waitForEcho(cdp);
  result.tablet = await evaluate(cdp, `(()=>{const c=document.querySelector('canvas');window.__g6Canvas=c;window.__g6Gl=c.getContext('webgl2')||c.getContext('webgl');const r=document.querySelector('${ECHO}').getBoundingClientRect();return{size:[innerWidth,innerHeight],hit:[r.width,r.height],overflow:document.documentElement.scrollWidth>innerWidth,canvas:document.querySelectorAll('canvas').length,webgl:!!window.__g6Gl}})()`);
  assert.deepEqual(result.tablet.size, [768, 1024]); assert.equal(result.tablet.overflow, false);
  assert.ok(result.tablet.hit[0] >= 44 && result.tablet.hit[1] >= 44 && result.tablet.webgl);
  result.tablet.groups = [await switchGroup(cdp, 1, 36, 1), await switchGroup(cdp, 2, 36, 1)];
  assert.deepEqual(result.tablet.groups, [true, true]);
  await shot(cdp, 'smoke-tablet-768x1024.png');

  await metrics(cdp, 1024, 768); await waitFor(cdp, 'innerWidth===1024&&innerHeight===768', 'resize'); await sleep(900);
  result.resize = await evaluate(cdp, `(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');return{size:[innerWidth,innerHeight],sameCanvas:c===window.__g6Canvas,sameContext:g===window.__g6Gl,regular:document.querySelectorAll('${REGULAR}').length,featured:document.querySelectorAll('${ECHO}').length,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
  assert.deepEqual(result.resize, { size: [1024, 768], sameCanvas: true, sameContext: true, regular: 35, featured: 1, overflow: false });
  await shot(cdp, 'smoke-resize-1024x768.png');

  await metrics(cdp, 768, 1024, true); await go(cdp, `${APP}?g6=reduced`); await waitForPond(cdp, 1); await waitForEcho(cdp);
  const before = await evaluate(cdp, `(()=>{const e=document.querySelector('${ECHO}'),r=e.getBoundingClientRect();window.__g6Clicks=0;e.addEventListener('click',()=>window.__g6Clicks++);return{x:r.x,y:r.y,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches}})()`);
  await sleep(1_200);
  const after = await evaluate(cdp, `(()=>{const r=document.querySelector('${ECHO}').getBoundingClientRect();return{x:r.x,y:r.y}})()`);
  assert.equal(before.reduce, true); assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 1);
  await evaluate(cdp, `document.querySelector('${ECHO}').focus()`);
  await waitFor(cdp, `document.activeElement===document.querySelector('${ECHO}')`, 'ECHO Enter focus');
  await key(cdp, 'Enter', 'Enter');
  await waitFor(cdp, 'window.__g6Clicks===1', 'Enter 激活'); await stopEcho(cdp);
  await evaluate(cdp, `document.querySelector('${ECHO}').focus()`);
  await waitFor(cdp, `document.activeElement===document.querySelector('${ECHO}')`, 'ECHO Space focus');
  await key(cdp, ' ', 'Space');
  await waitFor(cdp, 'window.__g6Clicks===2', 'Space 激活');
  result.reducedKeyboard = { staticDelta: Math.hypot(after.x - before.x, after.y - before.y), enter: 1, space: 1 };
  await shot(cdp, 'smoke-reduced-motion-keyboard-768.png'); await stopEcho(cdp);

  await metrics(cdp, 768, 1024); await go(cdp, `${APP}?forceFallback=1`); await waitForEcho(cdp, 'css-fallback');
  result.forcedFallback = await evaluate(cdp, `(()=>{const e=document.querySelector('${ECHO}'),r=e.getBoundingClientRect();return{mode:e.dataset.echoRenderMode,hit:[r.width,r.height],regularButtons:document.querySelectorAll('${REGULAR}').length,canvas:document.querySelectorAll('canvas').length}})()`);
  assert.equal(result.forcedFallback.mode, 'css-fallback'); assert.deepEqual(result.forcedFallback.hit, [64, 64]);
  assert.equal(result.forcedFallback.regularButtons, 0); assert.equal(result.forcedFallback.canvas, 0);
  await shot(cdp, 'smoke-forced-webgl-fallback.png');

  await go(cdp, APP); await waitForPond(cdp, 1); await waitForEcho(cdp, 'webgl');
  result.recovered = await evaluate(cdp, `(()=>{const c=document.querySelector('canvas');return{mode:document.querySelector('${ECHO}').dataset.echoRenderMode,regular:document.querySelectorAll('${REGULAR}').length,featured:document.querySelectorAll('${ECHO}').length,canvas:document.querySelectorAll('canvas').length,webgl:!!(c.getContext('webgl2')||c.getContext('webgl'))}})()`);
  assert.equal(result.recovered.mode, 'webgl'); assert.deepEqual([result.recovered.regular, result.recovered.featured], [35, 1]);
  assert.ok(result.recovered.canvas >= 1); assert.equal(result.recovered.webgl, true);
  await shot(cdp, 'smoke-webgl-recovered-768.png');
  assert.deepEqual(cdp.errors, []);
  assert.deepEqual(cdp.mutations, []);
  result.console = { errors: cdp.errors, warnings: cdp.warnings };
  result.mutations = cdp.mutations;
  await writeFile(path.join(OUT, 'matrix-results.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  try { await shot(cdp, 'smoke-matrix-failure.png'); } catch { /* 保留原始错误 */ }
  console.error(JSON.stringify({ result, errors: cdp.errors, warnings: cdp.warnings }, null, 2));
  throw error;
} finally { cdp.close(); }
