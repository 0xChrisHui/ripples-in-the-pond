import { mkdir, writeFile } from 'node:fs/promises';

const OUT = 'reviews/evidence/p11-score-single-sphere';
const BASE = 'http://127.0.0.1:3000';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(OUT, { recursive: true });

const targets = await fetch('http://127.0.0.1:9335/json').then((response) => response.json());
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('没有找到 Edge 审计页');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });

let id = 0;
const pending = new Map();
const protocolEvents = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) { protocolEvents.push(message); return; }
  const task = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) task.reject(message.error);
  else task.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async (expression, awaitPromise = false) => (
  await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
).result.value;

await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable'].map((method) => send(method)));

async function setViewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile,
  });
}

async function ready() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate(`Boolean(document.querySelector('button[aria-pressed]'))`);
    if (ready) return;
    await wait(250);
  }
  throw new Error(`页面未就绪：${BASE}/score-lab/1`);
}

async function resetLog() {
  await evaluate(`window.__scoreP9=[];if(!window.__scoreP9Handler){window.__scoreP9Handler=event=>window.__scoreP9.push({key:event.detail.effect.soundKey,accepted:event.detail.accepted,reason:event.detail.reason||null});window.addEventListener('jam:p9-trigger',window.__scoreP9Handler)}true`);
}

async function clickSphere(label) {
  const point = await evaluate(`(()=>{const button=[...document.querySelectorAll('button[aria-pressed]')].find(item=>item.getAttribute('aria-label').startsWith('${label}'));if(!button)return null;const rect=button.getBoundingClientRect();return{x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()`);
  if (!point) throw new Error(`找不到${label}球体按钮`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function snapshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
}

async function inspect() {
  return evaluate(`(()=>{const button=document.querySelector('button[aria-pressed]');const eclipse=document.getElementById('gl-eclipse-halo')?.closest('svg')?.querySelector(':scope > g');return{href:location.href,canvasCount:document.querySelectorAll('canvas').length,sphereButtons:document.querySelectorAll('button[aria-pressed]').length,pressed:button?.getAttribute('aria-pressed'),label:button?.getAttribute('aria-label'),eclipseOpacity:eclipse?getComputedStyle(eclipse).opacity:null,status:document.querySelector('.score-pond__status p')?.textContent,p9:window.__scoreP9||[],canvasStable:window.__pondCanvas?window.__pondCanvas===document.querySelector('canvas'):null}})()`);
}

await send('Emulation.setEmulatedMedia', { features: [] });
await setViewport(1440, 900);
await ready();
await resetLog();
await wait(700);
await evaluate(`window.__pondCanvas=document.querySelector('canvas');true`);
const desktopIdle = await inspect();
await clickSphere('播放');
await wait(1100);
const desktopActive = await inspect();
await snapshot('desktop-1440-active');
await wait(3500);
const desktopSettled = await inspect();
await clickSphere('暂停');

await setViewport(375, 812, true);
await wait(3200);
await resetLog();
const mobileIdle = await inspect();
await clickSphere('播放');
await wait(1100);
const mobileActive = await inspect();
await snapshot('mobile-375-active');
await clickSphere('暂停');

await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await wait(6500);
await resetLog();
await clickSphere('播放');
await wait(700);
const reducedMotion = await inspect();
await snapshot('mobile-375-reduced-motion');
await clickSphere('暂停');

const errors = protocolEvents.filter((event) => event.method === 'Runtime.exceptionThrown'
  || (event.method === 'Log.entryAdded' && event.params.entry.level === 'error')).map((event) => event.params);
const result = { generatedAt: new Date().toISOString(), desktopIdle, desktopActive, desktopSettled, mobileIdle, mobileActive, reducedMotion, errors };
await writeFile(`${OUT}/browser-audit.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
ws.close();
