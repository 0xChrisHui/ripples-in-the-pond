// /lens 播放锁定 / 两级退出 / 手机轻点门禁：node scripts/ui/lens/playback-gate.mjs [origin]
// 需要真实音频可加载；加载失败时报告并以非零退出（不假装通过）。
import assert from 'node:assert/strict';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3123';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(`!!(${expression})`)) return; await sleep(150); }
  throw new Error(`未满足：${expression}`);
}
const balls = "document.querySelectorAll('.pond-home-surface button[data-render-node-id]')";
const veilVar = (name) => evaluate(`parseFloat(document.querySelector('.lens-veil').style.getPropertyValue('${name}'))`);
const ballPoint = () => evaluate(`(() => { for (const n of ${balls}) { if (n.style.pointerEvents==='none') continue;
  const r=n.getBoundingClientRect(); if (r.width>8 && r.top>130 && r.bottom<innerHeight-80 && r.left>60 && r.right<innerWidth-60)
    return {x:r.x+r.width/2,y:r.y+r.height/2,id:n.dataset.renderNodeId}; } return null; })()`);
const pointOf = (id) => evaluate(`(() => { const n=document.querySelector('.pond-home-surface button[data-render-node-id="${id}"]'); const r=n.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,pe:n.style.pointerEvents,w:r.width}; })()`);
const ok = (name) => console.log('✅', name);
const press = async (key, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
};
async function open(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await send('Page.navigate', { url: `${origin}/lens` });
  await waitFor(`${balls}.length>=35 && document.querySelector('.lens-veil')?.dataset.on==='true'`);
  await sleep(800);
}
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__plays=0; const p=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){window.__plays++; return p.call(this);};" });

  // —— 桌面：点击播放 → 锁定 → 鼠标自由 → Esc 停止 → Esc 回首页
  await open(1440, 900, false);
  const ball = await ballPoint();
  assert.ok(ball);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ball.x, y: ball.y });
  await sleep(300);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ball.x, y: ball.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ball.x, y: ball.y, button: 'left', clickCount: 1 });
  await waitFor("document.querySelector('.lens-veil').dataset.lensLocked==='true'", 40000);
  ok('点击球 → 播放并锁定');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 120, y: 780 });
  await sleep(900);
  const lx = await veilVar('--lx'), ly = await veilVar('--ly');
  assert.ok(Math.hypot(lx - 120, ly - 780) > 150, `锁定后光圈不应跟鼠标：${lx},${ly}`);
  await waitFor('document.querySelector("[data-lens-panel]")');
  ok('锁定后鼠标自由，光圈与面板留在播放球上');
  await press('Escape', 'Escape', 27);
  await waitFor("document.querySelector('.lens-veil').dataset.lensLocked==='false'", 10000);
  assert.equal(await evaluate('location.pathname'), '/lens');
  ok('第一次 Esc：停止播放并解锁，仍在 /lens');
  await sleep(500);
  await press('Escape', 'Escape', 27);
  await waitFor("location.pathname==='/'", 15000);
  ok('第二次 Esc：回到 /');

  // —— 手机：第一次轻点选中，第二次轻点播放
  await open(390, 844, true);
  const tap = async (x, y) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const b2 = await ballPoint();
  assert.ok(b2, '手机上应有可轻点的球');
  const before = await evaluate('window.__plays');
  await tap(b2.x, b2.y);
  await waitFor('document.querySelector("[data-lens-panel]")', 10000); await sleep(400);
  assert.equal(await evaluate("document.querySelector('.lens-veil').dataset.lensLocked"), 'false', '第一次轻点不应播放');
  assert.equal(await evaluate('window.__plays'), before);
  const panel = await evaluate(`(() => { const r=document.querySelector('[data-lens-panel]').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
  assert.ok(panel.x >= 0 && panel.x + panel.w <= 390 && panel.y >= 60 && panel.y + panel.h <= 844, `手机面板越界 ${JSON.stringify(panel)}`);
  const small = await evaluate(`[...document.querySelectorAll('[data-lens-panel] button, [data-lens-panel] a')].filter(n => n.getBoundingClientRect().height < 43.5 && n.getClientRects().length).map(n => n.textContent.trim()+':'+Math.round(n.getBoundingClientRect().height))`);
  assert.deepEqual(small, [], `点击区应 ≥44px：${small}`);
  ok('手机：第一次轻点只选中，面板在画面内，按钮 ≥44px');
  const b3 = await pointOf(b2.id);
  console.log('第二次轻点位置', JSON.stringify(b3), JSON.stringify(b2));
  await tap(b3.x, b3.y);
  await waitFor("document.querySelector('.lens-veil').dataset.lensLocked==='true'", 40000);
  ok('手机：第二次轻点播放并锁定');
  await tap(20, 500);
  await waitFor("location.pathname==='/lens' && document.querySelector('.lens-veil').dataset.lensLocked==='false'", 10000);
  ok('手机：点空白先停止播放');
  await tap(20, 500);
  await waitFor("location.pathname==='/'", 15000);
  ok('手机：再点空白退出');
  assert.deepEqual(browser.pageErrors, []);
  console.log('\n播放门禁通过');
} catch (error) {
  console.error('❌', error.message);
  console.error('页面异常：', browser.pageErrors.slice(0, 5));
  process.exitCode = 1;
} finally {
  await send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
  browser.close();
}
