// /lens 两个回归门禁（CDP + 无头 Edge）：node scripts/ui/lens/regression-gate.mjs [origin]
// 1) 深链：选中并播放 N 号球 → 离开 /lens → 再次进入 /lens?track=N，光圈必须重新落在 N 号球上；
// 2) 键盘：球上获得焦点后，焦点转入面板，面板保持打开、选中不丢；焦点离开面板后才撤下。
import assert from 'node:assert/strict';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3000';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(`!!(${expression})`)) return; await sleep(150); }
  throw new Error(`未满足：${expression}`);
}
const ballPoint = () => evaluate(`(() => { for (const n of document.querySelectorAll('.pond-home-surface button[data-render-node-id]')) {
  if (n.style.pointerEvents==='none' || n.hasAttribute('data-echo-id')) continue; const r=n.getBoundingClientRect();
  if (r.width>20 && r.left>200 && r.right<1200 && r.top>200 && r.bottom<700) return {x:r.x+r.width/2,y:r.y+r.height/2}; } return null; })()`);
const press = async (key, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
};
const ok = (name) => console.log('✅', name);
const SCENE = "document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35 && document.querySelector('.lens-veil')?.dataset.on==='true'";

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // —— 1. 深链重进
  await send('Page.navigate', { url: `${origin}/lens` });
  await waitFor(SCENE, 90000);
  await sleep(600);
  const ball = await ballPoint();
  assert.ok(ball, '应有可点的球');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...ball });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...ball, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...ball, button: 'left', clickCount: 1 });
  await waitFor("document.querySelector('.lens-veil').dataset.lensLocked==='true'", 40000);
  const number = await evaluate("document.querySelector('.lens-veil').dataset.lensTarget");
  assert.match(number, /^\d+$/, '应读出曲号');
  await waitFor(`location.search.includes('track=${number}')`, 5000);
  ok(`播放 ${number} 号并写回地址`);
  // 指针移到空白处：否则悬停会把 N 号选中，掩盖深链是否真的生效
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 60, y: 860 });
  await sleep(500);

  // 离开 /lens（去 /artist），再从站内进入同一个深链
  await evaluate("window.next.router.push('/artist'); true");
  await waitFor("location.pathname==='/artist'", 30000);
  await sleep(800);
  await evaluate(`window.next.router.push('/lens?track=${number}'); true`);
  await waitFor(SCENE, 60000);
  await waitFor(`document.querySelector('.lens-veil').dataset.lensTarget==='${number}'`, 15000);
  ok(`再次进入 /lens?track=${number}：光圈重新落在 ${number} 号球（只选中，不自动播放）`);
  // 进入后不应自动播放（锁定由用户点击触发；深链只选中）
  assert.equal(await evaluate("document.querySelector('.lens-veil').dataset.lensLocked"), 'false', '深链不得自动播放');

  // —— 2. 键盘：球 → 面板 → 离开
  await send('Page.navigate', { url: `${origin}/lens` });
  await waitFor(SCENE, 90000);
  await sleep(600);
  await press('Tab', 'Tab', 9); // 切到键盘模式，才会触发 :focus-visible
  await evaluate(`(() => { const b=[...document.querySelectorAll('.pond-home-surface button[data-render-node-id]')]
    .filter(n => n.style.pointerEvents!=='none' && !n.hasAttribute('data-echo-id'))[0]; b.focus(); return true; })()`);
  await waitFor("document.querySelector('[data-lens-panel]')?.dataset.placed==='true' && document.querySelector('[data-lens-panel]').dataset.open==='true'", 10000);
  const target = await evaluate("document.querySelector('.lens-veil').dataset.lensTarget");
  ok(`键盘聚焦球 → 面板打开（${target} 号）`);

  await evaluate("document.querySelector('[data-lens-panel] .lens-play').focus(); true");
  await sleep(600);
  assert.equal(await evaluate("document.querySelector('[data-lens-panel]').dataset.open"), 'true', '焦点转入面板后面板必须保持打开');
  assert.equal(await evaluate("document.querySelector('.lens-veil').dataset.lensTarget"), target, '焦点转入面板后选中不应丢失');
  ok('焦点转入面板：面板保持、选中不丢，键盘可操作面板');

  await evaluate("document.activeElement.blur(); true");
  await waitFor("document.querySelector('[data-lens-panel]').dataset.open==='false'", 5000);
  ok('焦点离开面板到窗口外：面板撤下');

  assert.deepEqual(browser.pageErrors, [], `页面异常：${browser.pageErrors.join('\n')}`);
  console.log('\n回归门禁通过');
} catch (error) {
  console.error('❌', error.message);
  process.exitCode = 1;
} finally { browser.close(); }
