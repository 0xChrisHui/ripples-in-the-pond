import { writeFile } from 'node:fs/promises';

const BASE = process.env.P9_BASE_URL || 'https://pond-ripple.xyz';
const OUT = 'reviews/evidence/p9-v4-2';
const DEPLOYMENT = process.env.P9_DEPLOYMENT_SHA || 'unknown';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const port = process.env.P9_CDP_PORT || '9334';
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const pages = targets.filter((item) => item.type === 'page' && !item.url.startsWith('chrome-extension://'));
const target = pages.find((item) => item.url.startsWith(BASE))
  || pages.find((item) => item.url.startsWith('http://127.0.0.1:3000'))
  || pages[0];
if (!target) throw new Error('没有找到 P9 验收浏览器页');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });
let requestId = 0;
const pending = new Map();
const events = [];
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) { events.push(message); return; }
  const task = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) task.reject(message.error);
  else task.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (
  await send('Runtime.evaluate', { expression, returnByValue: true })
).result.value;

await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable'].map((method) => send(method)));
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await send('Page.navigate', { url: BASE });
await send('Page.bringToFront');
for (let attempt = 0; attempt < 100; attempt += 1) {
  const ready = await evaluate(`document.body.innerText.includes('33 个声音动画')`);
  if (ready) break;
  if (attempt === 99) throw new Error('生产首页演奏层未在 50 秒内就绪');
  await wait(500);
}
await wait(2500);
await evaluate(`window.__p9ProductionAudit=[];
  window.addEventListener('jam:p9-trigger',(event)=>window.__p9ProductionAudit.push({
    id:event.detail.effect.id,key:event.detail.effect.soundKey,
    accepted:event.detail.accepted,reason:event.detail.reason||null
  }));true`);

async function key(value) {
  const upper = value.toUpperCase();
  const params = { key: value, code: `Key${upper}`, windowsVirtualKeyCode: upper.charCodeAt(0) };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...params });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
}
await key('k');
await wait(120);
await key('a');
await wait(250);

const page = await evaluate(`({
  href:location.href,title:document.title,
  hudVisible:Boolean(document.querySelector('[data-p9-review]'))
    ||document.body.innerText.includes('P9 v4 · 33 音效'),
  tuningPanelVisible:document.body.innerText.includes('P9 v4 · 33 键参数'),
  keyboardCopy:document.body.innerText.includes('33 个声音动画'),
  triggerLog:window.__p9ProductionAudit||[]
})`);
const errors = events.filter((event) => event.method === 'Runtime.exceptionThrown'
  || (event.method === 'Log.entryAdded' && event.params.entry.level === 'error'))
  .map((event) => event.params);
const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile(`${OUT}/production-homepage.png`, Buffer.from(data, 'base64'));
const result = { generatedAt: new Date().toISOString(), deployment: DEPLOYMENT, page, errors };
await writeFile(`${OUT}/production-smoke.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
ws.close();
