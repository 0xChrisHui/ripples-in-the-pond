import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.P14_APP ?? 'http://localhost:3014/';
const CDP = process.env.P14_CDP ?? 'http://localhost:9336';
const OUT = path.resolve('reviews/evidence/p14-g6-track36/soak-results.json');
const REGULAR = 'button[aria-pressed]:not([data-featured-echo-hit])';
const ECHO = '[data-featured-echo-hit]';
const PLAYER = '[data-featured-echo-player]';
const SOAK_MS = 30 * 60_000;
const FIRST_FIVE_MS = 5 * 60_000;
const SAMPLE_MS = 60_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Client {
  constructor(url) {
    this.id = 0; this.jobs = new Map(); this.errors = []; this.warnings = [];
    this.mutations = []; this.ws = new WebSocket(url);
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
      if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? 'exception');
      }
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) {
        const line = p.args.map((arg) => arg.value ?? arg.description).join(' ');
        (p.type === 'error' && !line.startsWith('Error checking Cross-Origin-Opener-Policy') ? this.errors : this.warnings).push(line);
      }
      if (message.method === 'Network.requestWillBeSent') {
        const method = p.request.method.toUpperCase();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          this.mutations.push({ method, url: p.request.url, at: new Date().toISOString() });
        }
      }
      return;
    }
    const job = this.jobs.get(message.id); if (!job) return;
    this.jobs.delete(message.id);
    if (message.error) job.reject(new Error(message.error.message)); else job.resolve(message.result);
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
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description ?? out.exceptionDetails.text);
  return out.result.value;
}
async function waitFor(cdp, expression, label, deadline, tick = async () => {}) {
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await tick(); await sleep(150);
  }
  throw new Error(`等待失败：${label}`);
}
async function clickAt(cdp, point) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y,
    button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y,
    button: 'left', clickCount: 1 });
}
async function sample(cdp, startedAt) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const perf = Object.fromEntries(metrics.map((item) => [item.name, item.value]));
  const page = await evaluate(cdp, `(() => ({
    dom: document.getElementsByTagName('*').length,
    canvas: document.querySelectorAll('canvas').length,
    webglCanvas: document.querySelectorAll('canvas[data-engine^="three.js"]').length,
    regular: document.querySelectorAll('${REGULAR}').length,
    featured: document.querySelectorAll('${ECHO}').length,
    player: document.querySelector('${PLAYER}')?.dataset.featuredEchoPlayer ?? null,
    rafTicks: window.__p14SoakRaf?.ticks ?? 0,
    fps: window.__p14SoakRaf?.fps ?? 0
  }))()`);
  return { minute: (Date.now() - startedAt) / SAMPLE_MS, at: new Date().toISOString(),
    ...page, nodes: perf.Nodes, documents: perf.Documents, frames: perf.Frames,
    jsHeapUsed: perf.JSHeapUsedSize, taskDuration: perf.TaskDuration };
}
function longestGrowthRun(values, minimumStep) {
  let run = 0, longest = 0;
  for (let index = 1; index < values.length; index += 1) {
    run = values[index] - values[index - 1] > minimumStep ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const targets = await (await fetch(`${CDP}/json/list`)).json();
const target = targets.find((item) => item.type === 'page' && item.url.startsWith(APP));
assert.ok(target?.webSocketDebuggerUrl, '未找到 localhost:3014 的 Edge 页面');
const cdp = new Client(target.webSocketDebuggerUrl);
const result = { startedAt: null, endedAt: null, playback: null, samples: [],
  growth: null, errors: cdp.errors, warnings: cdp.warnings, mutations: cdp.mutations };

try {
  await cdp.open();
  for (const domain of ['Page', 'Runtime', 'Network', 'Performance']) await cdp.send(`${domain}.enable`);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const state = window.__p14SoakRaf = { ticks: 0, fps: 0, count: 0, last: performance.now() };
    const tick = (now) => { state.ticks++; state.count++; if (now - state.last >= 1000) {
      state.fps = state.count * 1000 / (now - state.last); state.count = 0; state.last = now;
    } requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  })();` });
  await cdp.send('Page.bringToFront'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Page.reload', { ignoreCache: true });
  await waitFor(cdp, `document.readyState==='complete'&&document.querySelectorAll('${REGULAR}').length===35&&document.querySelectorAll('${ECHO}').length===1`, '首页 35+1', Date.now() + 60_000);
  const soakStart = Date.now(), soakEnd = soakStart + SOAK_MS, firstFiveEnd = soakStart + FIRST_FIVE_MS;
  result.startedAt = new Date(soakStart).toISOString();
  let nextSample = soakStart;
  const collectDue = async () => {
    if (Date.now() >= nextSample && nextSample <= soakEnd) {
      result.samples.push(await sample(cdp, soakStart)); nextSample += SAMPLE_MS;
    }
  };
  await waitFor(cdp, `(() => { const e=document.querySelector('${ECHO}'); if(!e)return false;
    const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);
    return getComputedStyle(e).pointerEvents==='auto'&&(t===e||!!t?.closest('${ECHO}')); })()`,
  'ECHO 真实命中', firstFiveEnd, collectDue);
  await evaluate(cdp, `(() => { window.__p14SoakClicked=0;
    document.querySelector('${ECHO}').addEventListener('click',()=>window.__p14SoakClicked++,{once:true}); })()`);
  while (Date.now() < firstFiveEnd && !await evaluate(cdp, 'window.__p14SoakClicked===1')) {
    const point = await evaluate(cdp, `(() => { const r=document.querySelector('${ECHO}').getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    await clickAt(cdp, point); await sleep(180);
  }
  await waitFor(cdp, 'window.__p14SoakClicked===1', '真实指针点击一次', firstFiveEnd, collectDue);
  await waitFor(cdp, `document.querySelector('${PLAYER}')?.dataset.featuredEchoPlayer==='playing'`,
    'ECHO playing', firstFiveEnd, collectDue);
  const playingAt = Date.now();
  const playbackStart = await evaluate(cdp, `(() => { const p=document.querySelector('${PLAYER} [role=progressbar]');
    return { position:+p.getAttribute('aria-valuenow'), duration:+p.getAttribute('aria-valuemax') }; })()`);
  await waitFor(cdp, `document.querySelector('${PLAYER}')?.dataset.featuredEchoPlayer==='ended'`,
    'ECHO 自然 ended', firstFiveEnd, collectDue);
  const endedAt = Date.now();
  const playbackEnd = await evaluate(cdp, `(() => { const p=document.querySelector('${PLAYER} [role=progressbar]');
    return { position:+p.getAttribute('aria-valuenow'), duration:+p.getAttribute('aria-valuemax'),
      presence:+getComputedStyle(document.body).getPropertyValue('--pond-scene-presence') }; })()`);
  assert.ok(playbackStart.duration > 0 && playbackStart.position < 1_000);
  assert.ok(playbackEnd.position >= playbackEnd.duration - 100, '自然播放未走完整 duration/progress');
  assert.ok(endedAt - playingAt >= playbackStart.duration - 1_000, 'ECHO 非自然提前 ended');
  await waitFor(cdp, `Number(getComputedStyle(document.body).getPropertyValue('--pond-scene-presence'))>=.99`,
    'ended 后日食恢复', Date.now() + 5_000, collectDue);
  result.endedAt = new Date(endedAt).toISOString();
  result.playback = { playingAt: new Date(playingAt).toISOString(), elapsedMs: endedAt - playingAt,
    start: playbackStart, end: playbackEnd };
  while (Date.now() < soakEnd) { await collectDue(); await sleep(500); }
  result.samples.push(await sample(cdp, soakStart));
  assert.ok(result.samples.every((item) => item.canvas === result.samples[0].canvas && item.webglCanvas === 1), '30 分钟内 WebGL Canvas 不稳定');
  const final = result.samples.at(-1);
  assert.deepEqual([final.regular, final.featured], [35, 1]);
  const domRun = longestGrowthRun(result.samples.map((item) => item.dom), 0);
  const nodesRun = longestGrowthRun(result.samples.map((item) => item.nodes), 0);
  const heapRun = longestGrowthRun(result.samples.map((item) => item.jsHeapUsed), 256 * 1024);
  const firstHeap = median(result.samples.slice(0, 5).map((item) => item.jsHeapUsed));
  const lastHeap = median(result.samples.slice(-5).map((item) => item.jsHeapUsed));
  result.growth = { domRun, nodesRun, heapRun, firstHeap, lastHeap };
  assert.ok(domRun < 6 && nodesRun < 6, 'DOM/Performance Nodes 连续单调增长');
  assert.ok(heapRun < 8, 'JS Heap 连续显著单调增长');
  assert.ok(lastHeap <= firstHeap + Math.max(32 * 1024 * 1024, firstHeap * 0.35), 'JS Heap 尾段未收敛');
  assert.deepEqual(cdp.mutations, [], 'soak 期间出现业务 mutation');
  assert.deepEqual(cdp.errors, [], 'soak 期间出现页面错误');
  await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ gate: 'passed', playback: result.playback, growth: result.growth,
    samples: result.samples.length }, null, 2));
} catch (error) {
  await writeFile(OUT, `${JSON.stringify({ ...result, failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`);
  throw error;
} finally { cdp.close(); }
