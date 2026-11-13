// P20 存储隔离门禁（CDP + 无头 Edge）：node scripts/p20/storage-gate.mjs [origin]
// 正式页面（/，气泡默认开）不得读写气泡调参的 localStorage；/test5 才读写，且只存可调项。
import assert from 'node:assert/strict';
import { openTracksBrowser } from '../ui/tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3123';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(`!!(${expression})`)) return; await sleep(150); }
  throw new Error(`未满足：${expression}`);
}
const KEY = 'pond-bubble-tuning-v1';
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { window.__tuneIO = [];
    const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) { if (k === '${KEY}') window.__tuneIO.push('get'); return g.call(this, k); };
    Storage.prototype.setItem = function (k, v) { if (k === '${KEY}') window.__tuneIO.push('set'); return s.call(this, k, v); };
  })();` });
  // 预置一份“用户调过”的存档：opacity=1.9
  await send('Page.navigate', { url: `${origin}/test5` });
  await waitFor("document.querySelector('[data-pond-shell]')");
  await evaluate(`localStorage.setItem('${KEY}', JSON.stringify({ opacity: 1.9, popRadius: 0.05 })); true`);

  // 1. 正式页面（开气泡）：不读不写
  await send('Page.navigate', { url: `${origin}/` });
  await waitFor("document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35");
  await sleep(4000);
  assert.deepEqual(await evaluate('window.__tuneIO'), [], '正式页面不应读写气泡调参存档');
  console.log('✅ 正式页面不读不写气泡调参存档');

  // 2. /test5：读存档，滑块显示存档值；改动只写可调项
  await send('Page.navigate', { url: `${origin}/test5` });
  await waitFor("[...document.querySelectorAll('span')].some(s=>s.textContent.includes('整体亮度'))", 90000);
  const opacity = await evaluate(`(() => { const l=[...document.querySelectorAll('label')].find(x=>x.textContent.includes('整体亮度')); return l?.querySelector('input')?.value; })()`);
  assert.equal(opacity, '1.9', `/test5 应读到存档的亮度：${opacity}`);
  assert.ok((await evaluate('window.__tuneIO')).includes('get'));
  console.log('✅ /test5 读到存档（亮度 1.9）');
  const title = await evaluate(`[...document.querySelectorAll('div')].find(d=>/池塘气泡 · 手记（\d+ 项）/.test(d.textContent) && d.children.length===0)?.textContent`);
  console.log('控制台标题：', title);
  await evaluate(`(() => { const i=[...document.querySelectorAll('label')].find(x=>x.textContent.includes('整体亮度')).querySelector('input');
    const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i,'1.2'); i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await waitFor("window.__tuneIO.includes('set')", 4000);
  const saved = JSON.parse(await evaluate(`localStorage.getItem('${KEY}')`));
  assert.equal(saved.opacity, 1.2);
  assert.equal('popRadius' in saved, false, '只存可调项，固定项不入存档');
  console.log('✅ /test5 改动写入存档，且只含可调项（', Object.keys(saved).length, '项）');
  await evaluate(`localStorage.removeItem('${KEY}'); true`);
  console.log('全部通过');
} finally {
  browser.close();
}
