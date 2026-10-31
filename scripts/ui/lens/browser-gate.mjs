// /lens 浏览器门禁（CDP + 无头 Edge）：node scripts/ui/lens/browser-gate.mjs [origin]
// 无头 Edge 画不出 WebGL 球，但 DOM 命中层的球按钮在 → 验证别名切换、光圈、面板、退出路径。
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3123';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(`!!(${expression})`)) return; await sleep(120); }
  throw new Error(`未满足：${expression}`);
}
const shell = "document.querySelector('[data-pond-shell]')";
const balls = "document.querySelectorAll('.pond-home-surface button[data-render-node-id]')";
const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
async function click(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
const rectOf = (selector) => evaluate(`(() => { const n=document.querySelector(${JSON.stringify(selector)}); if(!n) return null;
  const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}; })()`);
async function firstVisibleBall() {
  return evaluate(`(() => { for (const n of ${balls}) { if (n.style.pointerEvents==='none') continue;
    const r=n.getBoundingClientRect(); if (r.width>8 && r.top>100 && r.bottom<innerHeight-60 && r.left>40 && r.right<innerWidth-60)
      return {x:r.x+r.width/2,y:r.y+r.height/2,id:n.dataset.renderNodeId,w:r.width}; } return null; })()`);
}
const results = [];
const ok = (name) => { results.push(name); console.log('✅', name); };
const press = async (key, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
};
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/` });
  await waitFor(`${shell}?.dataset.pondStage==='stable' && ${balls}.length>=35`);
  await evaluate(`window.__canvas=document.querySelector('[data-pond-shell] canvas'); window.__mount=${shell}.dataset.pondMountId;
    window.__stages=[]; new MutationObserver(()=>window.__stages.push(${shell}.dataset.pondStage+'/'+${shell}.dataset.pondTransition))
      .observe(${shell},{attributes:true,attributeFilter:['data-pond-stage']}); true`);
  assert.equal(await evaluate("document.querySelector('.lens-veil')"), null, '首页不应挂载光圈层');
  ok('首页无光圈层');

  // 1. 点顶栏「详情」→ /lens：不开事务、不重建
  const link = await rectOf('.pond-global-header nav a[href="/lens"]');
  assert.ok(link, '顶栏应有指向 /lens 的链接');
  await click(link.cx, link.cy);
  await waitFor("location.pathname==='/lens'");
  await waitFor("document.querySelector('.lens-veil')?.dataset.on==='true'");
  assert.equal(await evaluate('window.__stages.length'), 0, '别名切换不得产生过渡事务');
  assert.equal(await evaluate(`${shell}.dataset.pondMountId===window.__mount && document.querySelector('[data-pond-shell] canvas')===window.__canvas`), true);
  ok('/ → /lens 同场景（无事务、画布与挂载 id 不变）');

  // 2. 光圈跟随与选球
  const ball = await firstVisibleBall();
  assert.ok(ball, '应有可见的球');
  await move(700, 450); await sleep(500);
  const veil = await evaluate(`(() => { const s=document.querySelector('.lens-veil').style; return {x:s.getPropertyValue('--lx'),y:s.getPropertyValue('--ly')}; })()`);
  assert.ok(Math.abs(parseFloat(veil.x) - 700) < 3 && Math.abs(parseFloat(veil.y) - 450) < 3, `光圈应到鼠标处：${JSON.stringify(veil)}`);
  ok('光圈跟随鼠标');
  await move(ball.x, ball.y); await sleep(500);
  const target = await evaluate("document.querySelector('.lens-veil').dataset.lensTarget");
  assert.match(target, /^\d+$/, `光圈下应读出曲号：${target}`);
  ok(`光圈照到球 → 曲号 ${target}`);
  await waitFor("document.querySelector('[data-lens-panel]')");
  await sleep(300);
  const panel = await rectOf('[data-lens-panel]');
  assert.ok(panel.x >= 0 && panel.y >= 70 && panel.x + panel.w <= 1440 && panel.y + panel.h <= 900, `面板越界 ${JSON.stringify(panel)}`);
  assert.equal(await evaluate("document.querySelectorAll('#track-collect').length"), 0, '紧凑变体不得重复 #track-collect');
  assert.equal(await evaluate("document.querySelector('[data-lens-panel]').querySelectorAll('.lens-chain').length"), 2, 'OP 与 ETH 两条链');
  ok('面板出现、在画面内、两条链');
  // 面板宽限：鼠标移进面板后面板保持
  await move(panel.cx, panel.cy); await sleep(600);
  assert.ok(await rectOf('[data-lens-panel]'), '鼠标在面板内时面板应保持');
  await move(80, 820); await sleep(700);
  assert.equal(await rectOf('[data-lens-panel]'), null, '离开后面板应撤下');
  ok('面板宽限与撤下');

  // 3. 点空白退出 → /
  await click(80, 820);
  await waitFor(`location.pathname==='/' && ${shell}.dataset.pondStage==='stable'`);
  assert.equal(await evaluate('window.__stages.length'), 0);
  ok('点空白退出回到 /（仍无事务）');

  // 4. 后退前进：/ ↔ /lens
  await evaluate('history.back()'); await sleep(900);
  assert.equal(await evaluate('location.pathname'), '/lens');
  assert.equal(await evaluate('window.__stages.length'), 0, '后退前进也不得开事务');
  await waitFor("document.querySelector('.lens-veil')?.dataset.on==='true'");
  await evaluate('history.forward()'); await sleep(900);
  assert.equal(await evaluate('location.pathname'), '/');
  assert.equal(await evaluate("document.querySelector('.lens-veil')?.dataset.on"), 'false');
  ok('后退/前进 / ↔ /lens');

  // 5. Esc 退出
  await evaluate('history.back()'); await sleep(700);
  await press('Escape', 'Escape', 27);
  await waitFor("location.pathname==='/'");
  ok('Esc 退出');

  // 6. 深链：/lens?track=12 只选中，不播放
  const link2 = await rectOf('.pond-global-header nav a[href="/lens"]');
  await click(link2.cx, link2.cy); await waitFor("location.pathname==='/lens'");
  await evaluate("window.next.router.push('/lens?track=12'); true");
  await waitFor("document.querySelector('.lens-veil')?.dataset.lensTarget==='12'", 15000);
  assert.equal(await evaluate("document.querySelector('audio')?.paused ?? true"), true, '深链不得自动播放');
  ok('深链 ?track=12 只选中');

  // 7. 去别的页：功能层消失
  const artist = await rectOf('.pond-global-header nav a[href="/artist"]');
  await click(artist.cx, artist.cy);
  await waitFor("location.pathname==='/artist'");
  await waitFor("document.querySelector('.lens-veil')?.dataset.on==='false'");
  ok('去 /artist：遮罩撤下');
  assert.deepEqual(browser.pageErrors, [], `页面异常：${browser.pageErrors.join('\n')}`);
  console.log(`\n全部 ${results.length} 项通过`);
} catch (error) {
  console.error('❌', error.message);
  const { data } = await send('Page.captureScreenshot', { format: 'png' }).catch(() => ({}));
  if (data) await writeFile('reviews/evidence/lens-gate-failure.png', Buffer.from(data, 'base64'));
  console.error('页面异常：', browser.pageErrors.slice(0, 5));
  process.exitCode = 1;
} finally { browser.close(); }
