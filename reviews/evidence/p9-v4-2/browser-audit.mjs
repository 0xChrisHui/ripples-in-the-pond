import { mkdir, writeFile } from 'node:fs/promises';

const OUT = 'reviews/evidence/p9-v4-2';
const BASE = 'http://127.0.0.1:3000';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(OUT, { recursive: true });
const port = process.env.P9_CDP_PORT || '9334';
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const target = targets.find((item) => item.type === 'page' && item.url.startsWith(BASE));
if (!target) throw new Error('没有找到可审计浏览器页');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) { events.push(message); return; }
  const task = pending.get(message.id); pending.delete(message.id);
  if (message.error) task.reject(message.error);
  else task.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id; pending.set(next, { resolve, reject });
  ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async (expression, awaitPromise = false) => (
  await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
).result.value;
await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Performance.enable'].map((method) => send(method)));
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

async function ready() {
  await send('Page.bringToFront');
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ok = await evaluate(`Boolean([...document.querySelectorAll('button')].some(b=>/^(播放|暂停)/.test(b.getAttribute('aria-label')||'')))`);
    if (ok) return;
    await wait(500);
  }
  throw new Error(`页面未就绪：${await evaluate('location.href')}`);
}
async function installLog() {
  await evaluate(`window.__p9Audit=[];window.addEventListener('jam:p9-trigger',event=>window.__p9Audit.push({id:event.detail.effect.id,key:event.detail.effect.soundKey,accepted:event.detail.accepted,reason:event.detail.reason||null,at:performance.now()}));true`);
}
async function navigate(path) {
  await send('Page.navigate', { url: `${BASE}${path}` });
  await ready(); await installLog();
}
function keySpec(value) {
  if (value === 'space') return { key: ' ', code: 'Space', vk: 32 };
  if (/^[3-8]$/.test(value)) return { key: value, code: `Digit${value}`, vk: value.charCodeAt(0) };
  return { key: value, code: `Key${value.toUpperCase()}`, vk: value.toUpperCase().charCodeAt(0) };
}
async function key(value) {
  const spec = keySpec(value);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: spec.key, code: spec.code, windowsVirtualKeyCode: spec.vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: spec.key, code: spec.code, windowsVirtualKeyCode: spec.vk });
}
async function clickButton(prefix) {
  const point = await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')?.startsWith('${prefix}')&&getComputedStyle(x).pointerEvents!=='none');if(!b)return null;const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  if (!point) return false;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await wait(600); return true;
}
async function ensurePlaying() {
  if (await evaluate(`[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')?.startsWith('暂停'))`)) return;
  if (!await clickButton('播放')) throw new Error('没有可播放音乐圆');
}
async function ensurePaused() {
  if (await evaluate(`[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')?.startsWith('暂停'))`)) await clickButton('暂停');
}
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
}
async function hitMany(value, count, gap) {
  for (let at = 0; at < count; at += 1) { await key(value); if (gap) await wait(gap); }
}
const keys = [...'abcdefghijklmnopqrstuvwxyz', ...'345678', 'space'];

await navigate('/'); await ensurePaused();
const rootHasHud = await evaluate(`Boolean(document.querySelector('[data-p9-review]')||document.body.innerText.includes('P9 v4 · 33 音效'))`);
await key('k'); await key('a'); await wait(120);
const rootLog = await evaluate('window.__p9Audit');
await shot('homepage-p9-no-review-hud');

await navigate('/test3'); await ensurePaused();
for (const value of keys) { await key(value); await wait(42); }
const noMusicLog = await evaluate('window.__p9Audit');
const noMusic = { total: noMusicLog.length, accepted: noMusicLog.filter((item) => item.accepted).length,
  noEclipse: noMusicLog.filter((item) => item.reason === 'no-eclipse').length };

await navigate('/test3'); await ensurePlaying();
for (const value of keys) { await key(value); await wait(55); }
const allLog = await evaluate('window.__p9Audit');
const allKeys = { total: allLog.length, accepted: allLog.filter((item) => item.accepted).length,
  unique: new Set(allLog.map((item) => item.id)).size };
await shot('all-33-playing');

await navigate('/test3'); await ensurePlaying();
await hitMany('b', 6, 55); await wait(140);
const sporeBatches = await evaluate(`[...document.querySelectorAll('[data-spores]>g')].filter(g=>Number(g.style.opacity)>.02).length`);
await shot('b-six-independent-batches');

await navigate('/test3'); await ensurePlaying();
await hitMany('v', 6, 65); await wait(120);
const vLog = await evaluate('window.__p9Audit');
await shot('v-five-white-waves');

await navigate('/test3'); await ensurePaused();
await hitMany('5', 6, 65); await wait(180);
const colonyLog = await evaluate('window.__p9Audit');
const colonyStats = await evaluate('window.__p9Debug.stats()');
await shot('five-independent-mote-colonies');

await navigate('/test3'); await ensurePaused();
await key('h'); await wait(25); await key('3'); await wait(25); await key('8'); await wait(100);
const accentLog = await evaluate('window.__p9Audit');
const accentOpacity = await evaluate(`({dark:Number(document.querySelector('[data-dark]')?.style.opacity||0),film:Number(document.querySelector('[data-film]')?.style.opacity||0)})`);

await navigate('/test3'); await ensurePlaying();
await key('x'); await wait(30); await key('x'); await wait(30);
await key('6'); await wait(30); await key('6'); await wait(100);
const incrementalStats = await evaluate('window.__p9Debug.stats()');

await navigate('/test3'); await ensurePaused();
await hitMany('r', 5, 65); await wait(650);
const rPeak = await evaluate('window.__p9Debug.stats()'); await shot('r-five-petal-bursts');
await wait(8200);
const rSettled = await evaluate('window.__p9Debug.stats()');

await navigate('/test3'); await ensurePaused();
const samplerBefore = await evaluate('window.__p9Debug.stats().sampler.framePasses');
const frameWindow = await evaluate(`new Promise(resolve=>{let frames=0;const start=performance.now();const tick=now=>{frames++;now-start>=2000?resolve({frames,ms:now-start}):requestAnimationFrame(tick)};requestAnimationFrame(tick)})`, true);
const samplerAfter = await evaluate('window.__p9Debug.stats().sampler.framePasses');

async function lensTravel(reduced) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  await navigate('/test3'); await ensurePlaying(); await key('e'); await wait(180);
  const first = await evaluate(`Number((document.querySelector('[data-lens]>g')?.getAttribute('transform')||'').match(/rotate\\(([-0-9.]+)/)?.[1]||0)`);
  await wait(620);
  const second = await evaluate(`Number((document.querySelector('[data-lens]>g')?.getAttribute('transform')||'').match(/rotate\\(([-0-9.]+)/)?.[1]||0)`);
  return Math.abs(second - first);
}
const normalLensTravel = await lensTravel(false);
const reducedLensTravel = await lensTravel(true); await shot('reduced-motion-lens');
await send('Emulation.setEmulatedMedia', { features: [] });

await navigate('/test3'); await ensurePaused();
await hitMany('t', 16, 125);
for (let at = 0; at < 24; at += 1) { await key(at % 2 ? 'i' : 'l'); await wait(167); }
for (const value of ['b', 't', '5', 'space']) await key(value);
const stressPeak = await evaluate('window.__p9Debug.stats()');
const fps = await evaluate(`new Promise(resolve=>{let frames=0,start=performance.now();const tick=t=>{frames++;t-start>=3000?resolve({frames,ms:t-start,fps:frames*1000/(t-start)}):requestAnimationFrame(tick)};requestAnimationFrame(tick)})`, true);
await wait(10000);
const stressSettled = await evaluate('window.__p9Debug.stats()');
const errors = events.filter((event) => event.method === 'Runtime.exceptionThrown'
  || (event.method === 'Log.entryAdded' && event.params.entry.level === 'error')).map((event) => event.params);

const result = {
  generatedAt: new Date().toISOString(),
  homepage: { hudVisible: rootHasHud, log: rootLog }, noMusic, allKeys, sporeBatches,
  v: { accepted: vLog.filter((item) => item.accepted).length, capacity: vLog.filter((item) => item.reason === 'capacity').length },
  colonies: { accepted: colonyLog.filter((item) => item.accepted).length, capacity: colonyLog.filter((item) => item.reason === 'capacity').length, voices: colonyStats.runtime.byEffect.FX44 ?? 0 },
  accent: { log: accentLog, opacity: accentOpacity }, incremental: incrementalStats.runtime.byEffect,
  r: { peakFields: rPeak.burstFields, settledFields: rSettled.burstFields, settledVoices: rSettled.runtime.voices },
  sampler: { browserFrames: frameWindow.frames, samplePasses: samplerAfter - samplerBefore },
  reducedMotion: { normalLensTravel, reducedLensTravel, ratio: reducedLensTravel / Math.max(1, normalLensTravel) },
  stress: { peakVoices: stressPeak.runtime.voices, settledVoices: stressSettled.runtime.voices, settledFields: stressSettled.burstFields },
  fps, errors,
};
await writeFile(`${OUT}/browser-audit.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
ws.close();
