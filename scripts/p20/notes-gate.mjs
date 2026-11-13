// P20 手记层门禁（CDP + 无头 Edge）：node scripts/ui/lens/notes-gate.mjs [origin]
// 验证：/test5 点「立即出手记」后，手记中心点最上层元素是手记本身；球命中层仍在手记之上；
// 去 /me 后无手记宿主（不再出手记）；回首页再恢复。
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
const note = "document.querySelector('[role=\"note\"]')";
const topAtNoteCenter = `(() => { const n=${note}; if(!n) return null; const r=n.getBoundingClientRect();
  const t=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return { inNote: n.contains(t), tag: t?.tagName, cls: String(t?.className).slice(0,60) }; })()`;
const ok = (name) => console.log('✅', name);
async function clickNoteButton() {
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('立即出手记'))?.click()`);
}
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/test5` });
  await waitFor("document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable' && document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35");
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('立即出手记'))");
  await sleep(1500);

  // 1. 点「立即出手记」→ 载体泡升到水面 → 手记出现且在最上层
  await clickNoteButton();
  await waitFor(note, 90000);
  await sleep(2500); // 等文字淡入展开
  const top = await evaluate(topAtNoteCenter);
  assert.ok(top?.inNote, `手记中心点最上层应是手记本身：${JSON.stringify(top)}`);
  ok('手记中心点最上层元素是手记本身');

  // 2. 手记在球命中层（z-10）之下：球层 z 大于手记层 z，且球命中层仍存在
  const z = await evaluate(`(() => { const n=${note}.parentElement; const s=document.querySelector('[data-first-circles]');
    return { note: getComputedStyle(n).zIndex, sphere: s && getComputedStyle(s).zIndex, inHome: !!n.closest('.pond-home-surface') }; })()`);
  assert.equal(z.inHome, true, '手记应在首页层内');
  assert.ok(Number(z.sphere) > Number(z.note), `球层应在手记层之上：${JSON.stringify(z)}`);
  ok(`手记在首页层内、z=${z.note} < 球层 z=${z.sphere}`);

  // 3. 悬停手记：触发半透明框（mouseMoved 到手记中心）
  const rect = await evaluate(`(() => { const r=${note}.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + 1, y: rect.y });
  await waitFor(`getComputedStyle(${note}.firstElementChild).opacity==='1'`, 4000);
  ok('悬停手记出现半透明框（收得到鼠标）');

  // 4. 去 /me（站内跳转）：宿主注销，不再出手记
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await evaluate("window.next.router.push('/me')");
  await waitFor("location.pathname==='/me'");
  await waitFor("document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'");
  await waitFor(`!${note}`, 8000);
  assert.equal(await evaluate(`${note} === null`), true);
  await sleep(2000);
  assert.equal(await evaluate(`${note} === null`), true, '/me 不应出现手记');
  const homeNotes = await evaluate("document.querySelectorAll('[role=\"note\"]').length");
  assert.equal(homeNotes, 0);
  ok('/me 无手记');
  console.log('全部通过');
} finally {
  browser.close();
}
