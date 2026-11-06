// /lens 悬停面板门禁（CDP + 无头 Edge）：node scripts/ui/lens/hover-gate.mjs [origin]
// 1) 指针移到面板上后面板保持；移开面板并离开球后才撤下。
// 2) 在密集球群里快速横扫：记录面板开合次数与目标曲号切换次数（越少越不闪）。
import assert from 'node:assert/strict';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3000';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(`!!(${expression})`)) return; await sleep(120); }
  throw new Error(`未满足：${expression}`);
}
const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
// 可见 = 已打开且已落位（data-placed），否则读到的是 (0,0) 的旧矩形
const panelVisible = "(() => { const p=document.querySelector('[data-lens-panel]'); return !!p && (p.dataset.open ?? 'true') !== 'false' && p.dataset.placed === 'true'; })()";
const panelRect = () => evaluate(`(() => { const p=document.querySelector('[data-lens-panel]'); if(!p) return null;
  const r=p.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
const ok = (name) => console.log('✅', name);
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/lens` });
  await waitFor("document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35 && document.querySelector('.lens-veil')?.dataset.on==='true'", 90000);
  await sleep(800);

  // 选密集球群中心：屏幕内、非 #36 的球，数 90px 内邻居最多者。
  const dense = await evaluate(`(() => {
    const list=[...document.querySelectorAll('.pond-home-surface button[data-render-node-id]')]
      .filter(n => n.style.pointerEvents!=='none' && !n.hasAttribute('data-echo-id'))
      .map(n => { const r=n.getBoundingClientRect(); return {id:n.dataset.renderNodeId,x:r.x+r.width/2,y:r.y+r.height/2,r:r.width/2}; })
      .filter(c => c.r>8 && c.x>260 && c.x<1180 && c.y>220 && c.y<680);
    let best=null, n=-1;
    for (const c of list) { const k=list.filter(d => Math.hypot(d.x-c.x,d.y-c.y)<90).length; if (k>n) { n=k; best=c; } }
    return { best, neighbors: n };
  })()`);
  assert.ok(dense.best, '应有可用的球');
  console.log(`密集区中心球邻居（90px 内）：${dense.neighbors}`);

  // —— 1. 悬停 → 面板出现 → 移到面板上保持 → 移开后撤下
  await move(dense.best.x, dense.best.y);
  await waitFor(panelVisible, 3000);
  const shownTarget = await evaluate("document.querySelector('.lens-veil').dataset.lensTarget");
  const rect = await panelRect();
  await move(rect.x + rect.w / 2, rect.y + rect.h / 2);
  await sleep(900);
  assert.equal(await evaluate(panelVisible), true, '指针在面板上时面板不应消失');
  assert.equal(await evaluate("document.querySelector('.lens-veil').dataset.lensTarget"), shownTarget, '指针在面板上时不应换成底下的球');
  ok('指针移到面板上：面板保持、内容不变');
  await move(60, 860);
  await waitFor(`!(${panelVisible})`, 2000);
  ok('指针移开面板并离开球：面板撤下');

  // —— 2. 密集区快速横扫
  await move(dense.best.x - 110, dense.best.y);
  await waitFor(panelVisible, 3000).catch(() => {});
  await evaluate(`window.__log=[]; (() => {
    const snap = () => { const p=document.querySelector('[data-lens-panel]');
      window.__log.push({ visible: !!p && (p.dataset.open ?? 'true') !== 'false', target: document.querySelector('.lens-veil')?.dataset.lensTarget ?? '' }); };
    window.__obs?.disconnect(); window.__obs = new MutationObserver(snap);
    window.__obs.observe(document.body, { subtree: true, attributes: true, childList: true, attributeFilter: ['data-open', 'data-lens-target'] });
    return true; })()`);
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    await move(dense.best.x - 110 + (220 * i) / steps, dense.best.y);
    await sleep(16);
  }
  await sleep(400);
  const log = await evaluate('window.__log');
  let closes = 0, switches = 0, prevVisible = null, prevTarget = '';
  for (const e of log) {
    if (prevVisible === true && e.visible === false) closes++;
    if (e.target && prevTarget && e.target !== prevTarget) switches++;
    if (e.target) prevTarget = e.target;
    prevVisible = e.visible;
  }
  console.log(`横扫指标：面板合上 ${closes} 次，目标曲号切换 ${switches} 次（共记录 ${log.length} 次变化）`);
  assert.equal(await evaluate('location.pathname'), '/lens');
  console.log('门禁完成');
} catch (error) {
  console.error('❌', error.message);
  process.exitCode = 1;
} finally { browser.close(); }
