import { writeFile } from 'node:fs/promises';
const cdpBase = process.env.P15_CDP_URL ?? 'http://127.0.0.1:9337';
const siteBase = (process.env.P15_SITE_URL ?? 'http://127.0.0.1:3015').replace(/\/$/, '');
const sampleCount = Number(process.env.P15_SAMPLES ?? 10);
const output = process.env.P15_OUTPUT ?? 'reviews/evidence/p15-final/navigation.json';
const routes = (process.env.P15_ROUTES ?? '/me,/artist,/score/1,/').split(',');
const targets = await fetch(`${cdpBase}/json`).then((response) => response.json());
const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl
  && (item.url === 'about:blank' || item.url.startsWith(siteBase)));
if (!target) throw new Error('找不到可测浏览器页面');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true });
});
let commandId = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});
function send(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error('页面求值失败');
  return result.result.value;
}
async function waitFor(expression, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(expression);
      if (value) return value;
    } catch { /* 导航期间 execution context 会短暂销毁 */ }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`等待页面状态超时：${expression}`);
}
async function navigate(path) {
  await send('Page.navigate', { url: `${siteBase}${path}?__p15_nav=${Date.now()}` });
  await waitFor(`location.pathname === ${JSON.stringify(path)} && Boolean(document.querySelector('main'))`);
  if (path === '/') await waitFor(`Boolean(document.querySelector('[data-all-circles-interactive="true"]'))`);
  await evaluate(`new Promise((resolve) => setTimeout(() => resolve(true), 120))`);
}
await send('Page.enable');
await send('Runtime.enable');
await send('Page.bringToFront');
const samples = [];
for (const route of routes) {
  for (let index = 0; index < sampleCount; index += 1) {
    const origin = route === '/' ? '/artist' : '/';
    await navigate(origin);
    await waitFor(`Boolean(document.querySelector('.p15-route-feedback'))`);
    if (route !== '/score/1') {
      await waitFor(`[...document.querySelectorAll('a[href]')]
        .some((item) => new URL(item.href).pathname === ${JSON.stringify(route)})`);
    }
    await evaluate(`new Promise((resolve) => setTimeout(() => resolve(true), 80))`);
    const feedback = await evaluate(`new Promise((resolve) => {
      const wanted = ${JSON.stringify(route)};
      const realLink = [...document.querySelectorAll('a[href]')]
        .find((item) => new URL(item.href).pathname === wanted);
      const linkMode = realLink ? 'next-link' : 'full-document';
      const link = document.createElement('a');
      link.href = wanted;
      link.textContent = 'P15 feedback probe';
      document.body.append(link);
      link.addEventListener('click', (event) => event.preventDefault(), { once: true });
      const startedAt = performance.now();
      const timeout = setTimeout(() => resolve({
        linkMode, feedbackPaintMs: performance.now() - startedAt,
        feedbackVisible: false, error: 'feedback-paint-timeout',
      }), 250);
      const observePaint = () => {
        const indicator = document.querySelector('.p15-route-feedback');
        const visible = Boolean(indicator)
          && Number.parseFloat(getComputedStyle(indicator).opacity) > 0.01;
        if (!visible) { requestAnimationFrame(observePaint); return; }
        clearTimeout(timeout);
        resolve({
          linkMode,
          feedbackPaintMs: performance.now() - startedAt,
          feedbackVisible: true,
        });
      };
      requestAnimationFrame(observePaint);
      link.click();
    })`);

    await navigate(origin);
    await waitFor(`[...document.querySelectorAll('a[href]')]
      .some((item) => new URL(item.href).pathname === ${JSON.stringify(route)})`);
    await evaluate(`(() => {
      const link = [...document.querySelectorAll('a[href]')]
        .find((item) => new URL(item.href).pathname === ${JSON.stringify(route)});
      sessionStorage.setItem('p15-nav-intent', String(Date.now()));
      link.click();
    })()`);
    await waitFor(`(() => {
      if (location.pathname !== ${JSON.stringify(route)} || !document.querySelector('main')) return 0;
      return Date.now() - Number(sessionStorage.getItem('p15-nav-intent'));
    })()`);
    const shellPaintMs = await evaluate(`new Promise((resolve) => requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve(Date.now() - Number(sessionStorage.getItem('p15-nav-intent'))));
    }))`);
    samples.push({ route, index: index + 1, ...feedback,
      evidence: 'cdp-composited-frame', shellPaintMs });
    if ((index + 1) % 10 === 0) console.log(`${route} 已完成 ${index + 1}/${sampleCount}`);
  }
}

await navigate('/');
await waitFor(`Boolean(document.querySelector('.p15-route-feedback'))`);
await evaluate(`new Promise((resolve) => setTimeout(() => resolve(true), 50))`);
const duplicateProtected = await evaluate(`(() => {
  const link = document.createElement('a');
  link.href = '/me';
  document.body.append(link);
  link.addEventListener('click', (event) => event.preventDefault(), { once: true });
  link.click();
  const duplicate = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(duplicate);
  return duplicate.defaultPrevented;
})()`);
await navigate('/');
const modifiedLinkProtected = await evaluate(`(() => {
  delete document.documentElement.dataset.routePending;
  const link = document.createElement('a'); link.href = '/me'; document.body.append(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
  return document.documentElement.dataset.routePending !== 'true';
})()`);
const matrix = [];
for (const viewport of [{ width: 375, height: 844, reduced: true },
  { width: 768, height: 1024, reduced: false }, { width: 1024, height: 768, reduced: false },
  { width: 1440, height: 900, reduced: false }]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1,
    mobile: viewport.width < 768,
  });
  await send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{
      name: 'prefers-reduced-motion',
      value: viewport.reduced ? 'reduce' : 'no-preference',
    }],
  });
  await send('Page.navigate', {
    url: `${siteBase}/?forceFallback=1&__p15_matrix=${viewport.width}`,
  });
  let circlesReady = true;
  try {
    await waitFor(`Boolean(document.querySelector('button[data-track-id]'))`, 3_000);
  } catch {
    circlesReady = false;
  }
  await evaluate(`new Promise((resolve) => setTimeout(() => resolve(true), 500))`);
  matrix.push(await evaluate(`(() => {
    const circles = [...document.querySelectorAll('button[data-track-id]')];
    return {
      width: innerWidth,
      height: innerHeight,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      circlesReady: ${circlesReady},
      glHealth: document.querySelector('main')?.dataset.glHealth ?? null,
      circleCount: circles.length,
      uniqueTracks: new Set(circles.map((item) => item.dataset.trackId)).size,
      allInteractive: Boolean(document.querySelector('[data-all-circles-interactive="true"]')),
      hasHeader: Boolean(document.querySelector('header')),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  })()`));
}
await send('Emulation.clearDeviceMetricsOverride');
await writeFile(output, JSON.stringify({
  measuredAt: new Date().toISOString(), siteBase, sampleCount, routes,
  duplicateProtected, modifiedLinkProtected, samples, matrix,
}, null, 2));
socket.close();
console.log(`已写入 ${output}：${samples.length} 个导航样本`);
