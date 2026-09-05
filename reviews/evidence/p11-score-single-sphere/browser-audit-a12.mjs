import { mkdir, writeFile } from 'node:fs/promises';

const OUT = 'reviews/evidence/p11-score-single-sphere';
const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';
const CDP = process.env.AUDIT_CDP_URL || 'http://127.0.0.1:9335';
const PAGE = `${BASE}/score-lab/1`;
const V_TAIL_MS = 4_200;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(OUT, { recursive: true });

let targets;
try { targets = await fetch(`${CDP}/json`).then((response) => response.json()); }
catch { throw new Error(`无法连接 Edge CDP：${CDP}；请用 --remote-debugging-port=9335 启动 Edge`); }
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('Edge CDP 中没有可审计的 page target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let nextId = 0;
const pending = new Map();
const protocolEvents = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) { protocolEvents.push(message); return; }
  const task = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) task.reject(message.error); else task.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (
  await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
).result.value;
await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable'].map((method) => send(method)));

await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__a12PageErrors=[]; window.__a12ContextLosses=[];
  addEventListener('error',e=>window.__a12PageErrors.push(String(e.error?.stack||e.message)),true);
  addEventListener('unhandledrejection',e=>window.__a12PageErrors.push(String(e.reason?.stack||e.reason)),true);
  addEventListener('webglcontextlost',e=>window.__a12ContextLosses.push({at:performance.now(),tag:e.target?.tagName}),true);
` });

async function mode(width, height, mobile, reduced = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await send('Emulation.setEmulatedMedia', { features: [{
    name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference',
  }] });
}

async function navigate(url = PAGE) {
  const expectedPath = new URL(url).pathname;
  const previousOrigin = await evaluate('performance.timeOrigin');
  const currentPath = await evaluate('location.pathname');
  if (currentPath === expectedPath) await send('Page.reload', { ignoreCache: false });
  else await send('Page.navigate', { url });
  for (let i = 0; i < 120; i += 1) {
    try {
      const loaded = await evaluate(`location.pathname===${JSON.stringify(expectedPath)}
        && document.readyState==='complete' && performance.timeOrigin!==${previousOrigin}`);
      if (loaded) return;
    } catch { /* 新文档提交时旧 execution context 消失，继续等新 context。 */ }
    await wait(250);
  }
  throw new Error(`导航超时：${url}`);
}

async function until(expression, label, attempts = 80, interval = 250) {
  for (let i = 0; i < attempts; i += 1) {
    if (await evaluate(expression)) return;
    await wait(interval);
  }
  throw new Error(`等待超时：${label}`);
}

async function observed(expression, attempts = 100, interval = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (await evaluate(expression)) return true;
    await wait(interval);
  }
  return false;
}

async function ready() {
  await until(`Boolean(document.querySelector('main[data-capability][data-score-anchor-state] .score-record'))`, 'A1.2 DOM');
  await until(`document.querySelectorAll('canvas').length>=1`, 'PondGL Canvas');
  await until(`document.querySelector('main')?.dataset.scoreAnchorState==='idle'`, 'idle ready');
  await evaluate(`window.__a12Canvas=document.querySelector('canvas');window.__scoreP9=[];
    if(window.__scoreP9Handler)removeEventListener('jam:p9-trigger',window.__scoreP9Handler);
    window.__scoreP9Handler=event=>window.__scoreP9.push({key:event.detail.effect.soundKey,
      id:event.detail.effect.id,accepted:event.detail.accepted,reason:event.detail.reason||null,at:performance.now()});
    addEventListener('jam:p9-trigger',window.__scoreP9Handler);true`);
}

async function inspect(label) {
  return evaluate(`(()=>{const root=document.querySelector('main[data-capability]');
    const record=document.querySelector('.score-record');const playback=document.querySelector('.score-pond__playback');
    const eclipse=document.getElementById('gl-eclipse-halo')?.closest('svg')?.querySelector(':scope > g');
    const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0.05&&r.width>0&&r.height>0};
    return{label:${JSON.stringify(label)},href:location.href,capability:root?.dataset.capability,
      anchorState:root?.dataset.scoreAnchorState,fine:matchMedia('(hover: hover) and (pointer: fine)').matches,
      coarse:matchMedia('(pointer: coarse)').matches,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
      recordVisible:visible(record),recordLabel:record?.getAttribute('aria-label'),playbackVisible:visible(playback),
      playbackLabel:playback?.getAttribute('aria-label'),sphereCount:document.querySelectorAll('[data-sphere],button[aria-label="播放 33"],button[aria-label="暂停 33"]').length,
      eclipseOpacity:eclipse?Number(getComputedStyle(eclipse).opacity):null,canvasCount:document.querySelectorAll('canvas').length,
      canvasStable:window.__a12Canvas===document.querySelector('canvas'),overflowX:document.documentElement.scrollWidth-innerWidth,
      recordTransition:getComputedStyle(record).transitionDuration,p9:window.__scoreP9||[],
      pageErrors:window.__a12PageErrors||[],contextLosses:window.__a12ContextLosses||[]}})()`);
}

async function click(selector) {
  const point = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;
    const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  if (!point) throw new Error(`找不到点击目标：${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
}

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass: Boolean(pass), actual, expected });
const stages = {};

await mode(1440, 900, false);
await navigate(); await ready(); await wait(700);
stages.desktopIdle = await inspect('desktop-idle'); await shot('a12-desktop-1440-idle');
check('1440 fine capability', stages.desktopIdle.capability === 'fine' && stages.desktopIdle.fine, stages.desktopIdle, 'fine marker + fine media');
check('desktop idle record, no sphere', stages.desktopIdle.recordVisible && stages.desktopIdle.sphereCount === 0, stages.desktopIdle, 'record visible; sphere=0');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 910, y: 480 });
await click('.score-record'); await until(`document.querySelector('main')?.dataset.scoreAnchorState==='playing'`, 'desktop playing');
await until(`(window.__scoreP9||[]).length>=1`, 'V single trigger', 160, 50);
stages.vSingle = await inspect('v-single'); await shot('a12-desktop-v-single');
check('first V observation accepted', stages.vSingle.p9.length === 1 && stages.vSingle.p9[0]?.key === 'v'
  && stages.vSingle.p9[0]?.accepted, stages.vSingle.p9, 'first observation contains exactly one accepted V');
await wait(600);
stages.playingTransition = await inspect('playing-transition');
check('playing eclipse replaces record', !stages.playingTransition.recordVisible && stages.playingTransition.eclipseOpacity >= 0.9, stages.playingTransition, 'record hidden; eclipse opacity >= .9');
await until(`(window.__scoreP9||[]).length>=6`, 'V×6 pressure', 48);
stages.vPressure = await inspect('v-pressure'); await shot('a12-desktop-v-pressure');
const accepted = stages.vPressure.p9.filter((item) => item.accepted).length;
const capacity = stages.vPressure.p9.filter((item) => item.reason === 'capacity').length;
check('V×6 bounded pressure', stages.vPressure.p9.length === 6 && accepted === 5 && capacity === 1, { total: stages.vPressure.p9.length, accepted, capacity }, '6 / 5 / 1');
await click('.score-pond__playback'); await until(`document.querySelector('main')?.dataset.scoreAnchorState==='idle'`, 'stop to idle');
await wait(V_TAIL_MS + 600); stages.afterTail = await inspect('after-4.2s-tail'); await shot('a12-desktop-after-tail');
check('stop and longest tail recover', stages.afterTail.recordVisible && stages.afterTail.eclipseOpacity <= 0.05 && stages.afterTail.p9.length === 6, stages.afterTail, 'idle record; eclipse off; no late trigger');
await click('.score-pond__playback');
const restartObserved = await observed(`document.querySelector('main')?.dataset.scoreAnchorState==='playing'`);
await wait(800); stages.resumed = await inspect('restarted');
check('restart keeps Canvas', restartObserved && stages.resumed.canvasStable, { restartObserved, stage: stages.resumed }, 'playing observed + same Canvas');
if (stages.resumed.anchorState === 'playing') await click('.score-pond__playback');

await click('.score-pond__brand'); await until(`location.pathname==='/'`, 'leave score route');
await evaluate('history.back();true'); await until(`location.pathname==='/score-lab/1'`, 'return score route');
await ready(); await wait(700);
stages.routeReturn = await inspect('route-return');
check('route roundtrip clean return', stages.routeReturn.anchorState === 'idle' && stages.routeReturn.canvasStable, stages.routeReturn, 'fresh idle route + stable new Canvas');

await mode(375, 812, true); await navigate(); await ready(); await wait(700);
stages.mobileIdle = await inspect('mobile-idle'); await shot('a12-mobile-375-idle');
check('375 coarse idle record, no sphere', stages.mobileIdle.capability === 'coarse' && stages.mobileIdle.coarse && stages.mobileIdle.recordVisible && stages.mobileIdle.sphereCount === 0, stages.mobileIdle, 'coarse + record + sphere=0');
check('375 no horizontal overflow', stages.mobileIdle.overflowX <= 0, stages.mobileIdle.overflowX, '<= 0');
await click('.score-record'); await until(`document.querySelector('main')?.dataset.scoreAnchorState==='playing'`, 'mobile playing'); await wait(650);
stages.mobilePlaying = await inspect('mobile-playing'); await shot('a12-mobile-375-playing');
check('375 click becomes eclipse', stages.mobilePlaying.eclipseOpacity >= 0.9 && stages.mobilePlaying.canvasStable, stages.mobilePlaying, 'eclipse >= .9 + same Canvas');

await mode(375, 812, true, true); await navigate(); await ready(); await wait(500);
stages.reducedIdle = await inspect('reduced-idle'); await click('.score-record');
await until(`document.querySelector('main')?.dataset.scoreAnchorState==='playing'`, 'reduced playing'); await wait(200);
stages.reducedPlaying = await inspect('reduced-playing'); await shot('a12-mobile-375-reduced');
const reducedTransitionMs = Math.max(...stages.reducedPlaying.recordTransition.split(',').map((value) => {
  const duration = Number.parseFloat(value); return value.trim().endsWith('ms') ? duration : duration * 1000;
}));
check('reduced-motion state honored', stages.reducedIdle.reduced && reducedTransitionMs <= 20
  && stages.reducedPlaying.canvasStable && stages.reducedPlaying.eclipseOpacity >= 0.9,
{ reducedTransitionMs, idle: stages.reducedIdle, playing: stages.reducedPlaying }, 'reduce media + transition <=20ms + same Canvas');

const allProtocolErrors = protocolEvents.filter((event) => event.method === 'Runtime.exceptionThrown'
  || (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error')
  || (event.method === 'Log.entryAdded' && event.params.entry.level === 'error')).map((event) => event.params);
const isExternalWarning = (error) => {
  const url = error.entry?.url;
  const host = typeof url === 'string' ? new URL(url).hostname : '';
  const arweaveHost = host === 'arweave.net' || host.endsWith('.arweave.net');
  return error.entry?.source === 'network' && arweaveHost
    || error.type === 'error' && error.args?.[0]?.value === 'Error checking Cross-Origin-Opener-Policy:'
    && error.args?.[1]?.value === 'Failed to fetch';
};
const externalNetworkErrors = allProtocolErrors.filter(isExternalWarning);
const protocolErrors = allProtocolErrors.filter((error) => !isExternalWarning(error));
const pageErrors = Object.values(stages).flatMap((stage) => stage.pageErrors || []);
const contextLosses = Object.values(stages).flatMap((stage) => stage.contextLosses || []);
check('no console or page errors', protocolErrors.length === 0 && pageErrors.length === 0, { protocolErrors, pageErrors }, 'empty');
check('no WebGL context loss', contextLosses.length === 0, contextLosses, 'empty');
check('Canvas never remounts within route lifecycle', Object.values(stages).every((stage) => stage.canvasStable), Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, value.canvasStable])), 'all true');

const result = { generatedAt: new Date().toISOString(), page: PAGE, pass: checks.every((item) => item.pass), checks, stages,
  diagnostics: { protocolErrors, externalNetworkErrors, pageErrors, contextLosses },
  limitations: ['当前 PlayerProvider 的“停止”会归零；paused、续播与 ended 不能作为独立 DOM 状态断言，G6 只实证停止/重播。',
    '4.2 秒余韵以“无新增触发、唱片/日食复位、Canvas 稳定”作黑盒代理，页面未暴露内部 voice 数。',
    '粗指针由沙盒捕获层阻止事件抵达共享 pointer consumers；共享 WaterDistort/wake-field listener 仍注册，严格的零注册需跨越 A1.2 沙盒边界。',
    '375 coarse 为 Edge CDP 触控仿真，不替代 iOS/Android 真机 GPU、音频策略与手感验收。',
    'Arweave/COOP 连接失败会完整列入 externalNetworkErrors，但不冒充应用 console error。'] };
await writeFile(`${OUT}/browser-audit-a12.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
ws.close();
if (!result.pass) process.exitCode = 1;
