import { mkdir, readFile, writeFile } from 'node:fs/promises';

const OUT = 'reviews/evidence/p11-score-single-sphere/g7';
const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';
const CDP = process.env.AUDIT_CDP_URL || 'http://127.0.0.1:9335';
const PAGE = `${BASE}/score-lab/1`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(OUT, { recursive: true });

const permanentEvents = JSON.parse(await readFile(`${OUT}/permanent-events.json`, 'utf8'));
const timeline = [...permanentEvents].sort((a, b) => a.time - b.time);
const expectedKeys = timeline.map((event) => event.key.toLowerCase());
const targetList = await fetch(`${CDP}/json`).then((response) => response.json());
const pages = targetList.filter((item) => item.type === 'page');
const target = pages.find((item) => item.url === 'about:blank')
  ?? pages.find((item) => /^https?:/.test(item.url))
  ?? pages.find((item) => !/^(chrome-extension|edge):/.test(item.url));
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
  window.__g7Errors=[];window.__g7Losses=[];window.__g7Audio=[];window.__g7Webgl=new Set();
  addEventListener('error',e=>window.__g7Errors.push(String(e.error?.stack||e.message)),true);
  addEventListener('unhandledrejection',e=>window.__g7Errors.push(String(e.reason?.stack||e.reason)),true);
  addEventListener('webglcontextlost',e=>window.__g7Losses.push({at:performance.now(),tag:e.target?.tagName}),true);
  const NativeAudio=window.AudioContext||window.webkitAudioContext;
  if(NativeAudio){class TrackedAudio extends NativeAudio{constructor(...args){super(...args);window.__g7Audio.push(this)}}
    window.AudioContext=TrackedAudio;if(window.webkitAudioContext)window.webkitAudioContext=TrackedAudio;}
  const nativeGet=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){const value=nativeGet.call(this,type,...args);
    if(value&&String(type).includes('webgl'))window.__g7Webgl.add(value);return value;};
` });

async function mode(width, height, mobile, reducedMotion = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await send('Emulation.setEmulatedMedia', { media: '', features: [{
    name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference',
  }] });
}

async function navigate() {
  await send('Page.navigate', { url: PAGE });
  await until(`location.pathname==='/score-lab/1'&&document.readyState==='complete'`, '页面完成');
}

async function until(expression, label, attempts = 160, interval = 100) {
  for (let index = 0; index < attempts; index += 1) {
    try { if (await evaluate(expression)) return; } catch { /* 等待新 execution context。 */ }
    await wait(interval);
  }
  throw new Error(`等待超时：${label}`);
}

async function ready() {
  await until(`document.querySelector('main.score-pond')?.dataset.scoreAnchorState==='idle'`, 'idle', 900);
  await until(`document.querySelectorAll('canvas').length>=1`, 'Canvas', 900);
  await evaluate(`window.__g7Canvas=[...document.querySelectorAll('canvas')];window.__g7P9=[];
    addEventListener('jam:p9-trigger',event=>window.__g7P9.push({key:event.detail.effect.soundKey,
      id:event.detail.effect.id,accepted:event.detail.accepted,reason:event.detail.reason||null,at:performance.now()}));true`);
}

async function point(selector) {
  const value = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;
    const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  if (!value) throw new Error(`找不到点击目标：${selector}`);
  return value;
}

async function click(selector) {
  const at = await point(selector);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', clickCount: 1 });
}

async function tap(selector) {
  const at = await point(selector);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1, radiusX: 2, radiusY: 2 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
}

async function inspect(label) {
  return evaluate(`(()=>{const root=document.querySelector('main.score-pond');const anchor=document.querySelector('.record-anchor');
    const visual=document.querySelector('.record-anchor__visual');const action=document.querySelector('.record-anchor__action');
    const transient=[...document.querySelectorAll('[data-dark],[data-film],[data-invert],[data-boundary],[data-spores]>g,[data-lens],[data-trace]')]
      .map(el=>Number(getComputedStyle(el).opacity)||0);return{label:${JSON.stringify(label)},anchor:root?.dataset.scoreAnchorState,
      eventCount:Number(root?.dataset.p9EventCount),keyCount:Number(root?.dataset.p9KeyCount),
      unmapped:Number(root?.dataset.p9UnmappedCount),p9:window.__g7P9||[],capability:root?.dataset.capability,
      finePointer:matchMedia('(hover: hover) and (pointer: fine)').matches,
      coarsePointer:matchMedia('(pointer: coarse)').matches,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      anchorVisual:anchor?.dataset.visual,visualLabel:visual?.getAttribute('aria-label'),visualTabIndex:visual?.tabIndex,
      actionLabel:action?.getAttribute('aria-label'),actionTabIndex:action?.tabIndex,
      canvasStable:window.__g7Canvas?.every((item,index)=>item===[...document.querySelectorAll('canvas')][index]),
      canvasCount:document.querySelectorAll('canvas').length,maxTransient:Math.max(0,...transient),
      audioContexts:(window.__g7Audio||[]).map(context=>context.state),webglContexts:window.__g7Webgl?.size||0,
      errors:window.__g7Errors||[],losses:window.__g7Losses||[],overflowX:document.documentElement.scrollWidth-innerWidth}})()`);
}

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass: Boolean(pass), actual, expected });
const stages = {};

await mode(1440, 900, false); await navigate(); await ready();
stages.idle = await inspect('idle');
check('真实覆盖 35 事件 / 13 键', stages.idle.eventCount === 35 && stages.idle.keyCount === 13 && stages.idle.unmapped === 0, stages.idle, '35 / 13 / 0');
check('1440 精细指针能力合同', stages.idle.capability === 'fine' && stages.idle.finePointer && !stages.idle.coarsePointer,
  stages.idle, 'data-capability=fine 且 fine media=true');
await click('.record-anchor__visual');
await until(`document.querySelector('.record-anchor[data-visual="eclipse"]')`, '日食停止按钮', 900);
await evaluate(`document.querySelector('.record-anchor__visual').focus();true`);
stages.keyboardReady = await inspect('keyboard-ready');
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await until(`document.querySelector('main')?.dataset.scoreAnchorState==='idle'`, '键盘停止');
stages.keyboardStop = await inspect('keyboard-stop');
check('日食键盘可停止', stages.keyboardReady.anchorVisual === 'eclipse' && stages.keyboardReady.visualTabIndex === 0
  && stages.keyboardStop.anchor === 'idle', { before: stages.keyboardReady, after: stages.keyboardStop }, '可聚焦日食按钮 + Enter 后 idle');

await evaluate(`window.__g7P9=[];true`); await click('.record-anchor__visual');
await until(`(window.__g7P9||[]).length>=35`, '35 条永久事件', 180, 100);
stages.fullEvents = await inspect('full-events'); await shot('desktop-full-events');
const actualKeys = stages.fullEvents.p9.map((item) => item.key);
check('真实整段按永久时间线触发', JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), actualKeys, expectedKeys);
check('注册表无 no-eclipse 拒绝', !stages.fullEvents.p9.some((item) => item.reason === 'no-eclipse'), stages.fullEvents.p9.filter((item) => !item.accepted), '允许容量让位，但无 no-eclipse');
const alternating = timeline.some((event, index) => timeline[index + 2]
  && event.key === timeline[index + 2].key && event.key !== timeline[index + 1].key
  && timeline[index + 2].time - event.time <= 80);
const fourNear = timeline.some((event, index) => new Set(timeline.slice(index, index + 4).map((item) => item.key)).size === 4
  && timeline[index + 3].time - event.time <= 160);
check('真实时间线含两键交替压力', alternating, timeline, '80ms 内 A-B-A');
check('真实时间线含四键近同时', fourNear, timeline.slice(0, 4), '160ms 内四个不同键');
await wait(8_500); stages.afterTail = await inspect('after-tail'); await shot('desktop-after-tail');
check('最长余韵恢复', stages.afterTail.maxTransient <= 0.01 && stages.afterTail.p9.length === 35, stages.afterTail, '无新增触发且瞬态层透明');
const contextBaseline = { audio: stages.afterTail.audioContexts.length, webgl: stages.afterTail.webglContexts };
await click('.record-anchor__action'); await click('.record-anchor__visual'); await until(`(window.__g7P9||[]).length>=36`, '重播首事件');
stages.replay = await inspect('replay');
check('重播不重挂 Canvas / 不新增 context', stages.replay.canvasStable
  && stages.replay.audioContexts.length === contextBaseline.audio && stages.replay.webglContexts === contextBaseline.webgl,
{ baseline: contextBaseline, replay: stages.replay }, 'Canvas 稳定且 Audio/WebGL context 数不增长');
await click('.record-anchor__action');

await mode(375, 812, true); await navigate(); await ready();
stages.mobileIdle = await inspect('mobile-idle');
check('375 粗指针能力合同', stages.mobileIdle.capability === 'coarse' && stages.mobileIdle.coarsePointer
  && !stages.mobileIdle.finePointer, stages.mobileIdle, 'data-capability=coarse 且 fine media=false');
await tap('.record-anchor__visual');
await until(`document.querySelector('.record-anchor[data-visual="eclipse"]')`, '移动端日食停止按钮', 900); await shot('mobile-playing');
await tap('.record-anchor__action'); await until(`document.querySelector('main')?.dataset.scoreAnchorState==='idle'`, '触控停止');
stages.mobileStop = await inspect('mobile-stop');
check('日食触控可停止且无横向溢出', stages.mobileStop.anchor === 'idle' && stages.mobileStop.overflowX <= 0, stages.mobileStop, 'tap 后 idle；overflow <= 0');

await mode(375, 812, true, true); await navigate(); await ready();
stages.reducedIdle = await inspect('reduced-idle'); await tap('.record-anchor__visual');
await until(`document.querySelector('main')?.dataset.scoreAnchorState==='playing'`, 'reduced-motion 播放状态');
stages.reducedPlaying = await inspect('reduced-playing'); await shot('mobile-reduced-playing');
check('reduced-motion 独立护栏', stages.reducedIdle.reducedMotion && stages.reducedIdle.capability === 'coarse'
  && stages.reducedPlaying.anchor === 'playing', { idle: stages.reducedIdle, playing: stages.reducedPlaying },
  'reduce media=true、仍为 coarse、播放状态可见');
await tap('.record-anchor__action');

const protocolErrors = protocolEvents.filter((event) => ['Log.entryAdded', 'Runtime.exceptionThrown'].includes(event.method))
  .filter((event) => event.method === 'Runtime.exceptionThrown' || event.params?.entry?.level === 'error');
check('console / page error 为零', protocolErrors.length === 0 && stages.mobileStop.errors.length === 0, { protocolErrors, pageErrors: stages.mobileStop.errors }, '空');
check('WebGL context loss 为零', stages.mobileStop.losses.length === 0, stages.mobileStop.losses, '空');
const result = { generatedAt: new Date().toISOString(), page: PAGE, summary: { total: checks.length, passed: checks.filter((item) => item.pass).length, failed: checks.filter((item) => !item.pass).length }, checks, stages };
await writeFile(`${OUT}/browser-audit.json`, `${JSON.stringify(result, null, 2)}\n`);
ws.close();
console.log(JSON.stringify(result.summary));
if (result.summary.failed) process.exitCode = 1;
