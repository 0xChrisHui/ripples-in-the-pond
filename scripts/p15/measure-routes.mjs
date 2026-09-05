import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.P15_CDP_URL ?? 'http://127.0.0.1:9336';
const siteBase = (process.env.P15_SITE_URL ?? 'https://pond-ripple.xyz').replace(/\/$/, '');
const sampleCount = Number(process.env.P15_SAMPLES ?? 50);
const mode = process.env.P15_CACHE_MODE ?? 'warm';
const output = process.env.P15_OUTPUT ?? 'reviews/evidence/p15-baseline/routes-warm.json';
const routes = (process.env.P15_ROUTES ?? '/,/me,/artist,/score/1').split(',');
const timeoutMs = Number(process.env.P15_TIMEOUT_MS ?? 20_000);

if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new Error('P15_SAMPLES 必须是正整数');
if (!['warm', 'cold'].includes(mode)) throw new Error('P15_CACHE_MODE 仅支持 warm/cold');

const targets = await fetch(`${cdpBase}/json`).then((response) => response.json());
const target = targets.find((item) => (
  item.type === 'page' && item.webSocketDebuggerUrl
  && (item.url === 'about:blank' || item.url.startsWith(siteBase))
));
if (!target) throw new Error(`无法在 ${cdpBase} 找到浏览器页面`);

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  }
});

function send(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const observerSource = `(() => {
  window.__p15 = { cls: 0, longestTask: 0, shellAt: null, firstCirclesAt: null, allCirclesAt: null };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__p15.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__p15.longestTask = Math.max(window.__p15.longestTask, entry.duration);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  const watchPaint = () => {
    const state = window.__p15;
    if (state.shellAt == null && document.querySelector('main')) state.shellAt = performance.now();
    const circles = document.querySelectorAll('button[data-track-id]');
    if (state.firstCirclesAt == null && circles.length > 0) state.firstCirclesAt = performance.now();
    if (state.allCirclesAt == null && document.querySelector('[data-all-circles-interactive="true"]')) {
      state.allCirclesAt = performance.now();
    }
    if (performance.now() < 30_000) {
      requestAnimationFrame(watchPaint);
    }
  };
  requestAnimationFrame(watchPaint);
})();`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: observerSource });

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? '页面求值失败');
  return result.result.value;
}

async function measure(route, index) {
  if (mode === 'cold') {
    await send('Network.clearBrowserCache');
    await send('Network.clearBrowserCookies');
  }
  const targetUrl = new URL(`${siteBase}${route}`);
  targetUrl.searchParams.set('__p15', `${mode}-${index}-${Date.now()}`);
  await send('Page.navigate', { url: targetUrl.href });
  const settleMs = route === '/' ? Math.min(timeoutMs, 8_000) : Math.min(timeoutMs, 2_000);
  const deadline = Date.now() + settleMs;
  let ready = false;
  const observed = { shellAt: null, firstCirclesAt: null, allCirclesAt: null };
  while (!ready && Date.now() < deadline) {
    try {
      const state = await evaluate(`({
        route: location.pathname,
        now: performance.now(),
        shell: Boolean(document.querySelector('main')),
        circles: document.querySelectorAll('button[data-track-id]').length,
        allCircles: Boolean(document.querySelector('[data-all-circles-interactive="true"]')),
      })`);
      if (state.route === route && state.shell && observed.shellAt == null) observed.shellAt = state.now;
      if (state.route === route && state.circles > 0 && observed.firstCirclesAt == null) observed.firstCirclesAt = state.now;
      if (state.route === route && state.allCircles && observed.allCirclesAt == null) observed.allCirclesAt = state.now;
      ready = observed.shellAt != null && (route !== '/' || observed.allCirclesAt != null);
    } catch {
      ready = false;
    }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  const value = await evaluate(`(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null;
    const resources = performance.getEntriesByType('resource');
    return {
      route: location.pathname,
      responseStart: nav?.responseStart ?? null,
      domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
      loadEvent: nav?.loadEventEnd ?? null,
      fcp,
      ...window.__p15,
      resourceCount: resources.length,
      transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    };
  })()`);
  return { index: index + 1, ...value, ...observed };
}

const samples = [];
for (const route of routes) {
  for (let index = 0; index < sampleCount; index += 1) {
    try {
      samples.push(await measure(route, index));
    } catch (error) {
      samples.push({ route, index: index + 1, error: error.message });
    }
  }
}

await writeFile(output, JSON.stringify({
  measuredAt: new Date().toISOString(), siteBase, cdpBase, mode, sampleCount, routes, samples,
}, null, 2));
socket.close();
console.log(`已写入 ${output}：${samples.length} 个样本`);
