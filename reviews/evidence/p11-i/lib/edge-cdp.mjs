import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// P11-I 各步浏览器 Gate 共用：无界面 Edge + 软件 WebGL，只做只读页面操作。
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export const BASE = (process.env.P11_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function openEdge({ port = 9223, profile = '.edge-i2-profile' } = {}) {
  const browser = spawn(EDGE, [
    '--headless=new', '--no-first-run', '--disable-features=msEdgeFirstRunExperience',
    `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve(profile)}`,
    '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const cdp = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${cdp}/json/version`)).ok) break; } catch { /* Edge 仍在启动 */ }
    await wait(200);
  }
  const target = await (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) {
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        errors.push(`${details.text} ${details.exception?.description ?? ''}`.slice(0, 300));
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ').slice(0, 300));
      }
      return;
    }
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id;
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? '页面求值失败');
    return result.result.value;
  };
  const until = async (expression, label, timeout = 15_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await evaluate(expression)) return; } catch { /* 导航提交期间继续等待 */ }
      await wait(40);
    }
    throw new Error(`等待超时：${label}`);
  };
  const load = async (pathname, ready = `Boolean(document.querySelector('[data-pond-mount-id]'))`) => {
    await send('Page.navigate', { url: `${BASE}${pathname}` });
    await until(`location.pathname===${JSON.stringify(pathname.split('?')[0])} && document.readyState==='complete' && ${ready}`,
      `加载 ${pathname}`, 60_000);
  };
  await Promise.all([send('Page.enable'), send('Runtime.enable')]);
  const close = () => { socket.close(); browser.kill(); };
  return { send, evaluate, until, load, errors, close };
}

export async function writeEvidence(file, data) {
  const output = path.resolve(file);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return output;
}

export const SHELL_SNAPSHOT = `(() => {
  const shell = document.querySelector('[data-pond-shell]');
  const core = document.querySelector('[data-pond-mount-id]');
  const canvases = [...document.querySelectorAll('canvas')];
  const home = document.querySelector('main[data-pond-root]');
  return {
    path: location.pathname,
    phase: shell?.dataset.pondTransition ?? null,
    owner: shell?.dataset.pondSceneOwner ?? null,
    mountId: core?.dataset.pondMountId ?? null,
    sameCore: core === window.__p11Core,
    sameCanvas: canvases[0] === window.__p11Canvas,
    canvasCount: canvases.length,
    glHealth: home?.dataset.glHealth ?? null,
    homeInert: Boolean(home?.inert),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  };
})()`;

export const MARK_CORE = `window.__p11Core = document.querySelector('[data-pond-mount-id]');
  window.__p11Canvas = document.querySelector('canvas'); true`;

export const CANVAS_READY = `Boolean(document.querySelector('[data-pond-mount-id]')) && Boolean(document.querySelector('canvas'))`;

// 记录外壳相位与目标入口出现的时间，用于区分“产品收场慢”和“采样轮询慢”。
export const TIMELINE = `(() => {
  const shell = document.querySelector('[data-pond-shell]');
  window.__p11Timeline = [];
  const push = () => {
    const entry = { t: Math.round(performance.now()), path: location.pathname,
      phase: shell?.dataset.pondTransition ?? null, back: Boolean(document.querySelector('.me-archive__back')) };
    const last = window.__p11Timeline.at(-1);
    if (last && last.path === entry.path && last.phase === entry.phase && last.back === entry.back) return;
    window.__p11Timeline.push(entry);
  };
  new MutationObserver(push).observe(shell, { attributes: true, attributeFilter: ['data-pond-transition'] });
  new MutationObserver(push).observe(document.querySelector('.pond-route-surface'), { childList: true, subtree: true });
  for (const [name, node] of [['home', document.querySelector('main[data-pond-root]')],
    ['route', document.querySelector('.pond-route-surface')]]) {
    node?.addEventListener('transitionend', (event) => {
      if (event.target !== node || event.propertyName !== 'opacity') return;
      window.__p11Timeline.push({ t: Math.round(performance.now()), event: name + '-end',
        opacity: getComputedStyle(node).opacity });
    });
  }
  window.__p11LongTasks = [];
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => window.__p11LongTasks.push({
    t: Math.round(entry.startTime), ms: Math.round(entry.duration) }))).observe({ type: 'longtask' });
  window.__p11Mark = () => { window.__p11Timeline = []; window.__p11LongTasks = []; return Math.round(performance.now()); };
  return true;
})()`;
