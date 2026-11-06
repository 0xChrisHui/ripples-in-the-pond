// /lens 光圈边缘门禁（CDP + 无头 Edge）：node scripts/ui/lens/edge-gate.mjs [origin]
// 1) 指针离开窗口后光圈停在最后位置，不回屏幕中心；
// 2) 从边缘重新进入，光圈平滑到新位置；
// 3) 在边缘快速来回（离开 / 进入交替），光圈不弹回中心。
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
/** 模拟鼠标离开浏览器窗口（页面收到的就是 documentElement 上的 mouseleave）。 */
const leaveWindow = () => evaluate("document.documentElement.dispatchEvent(new MouseEvent('mouseleave'))");
const ring = () => evaluate(`(() => { const s=document.querySelector('.lens-veil').style;
  return { x: parseFloat(s.getPropertyValue('--lx')), y: parseFloat(s.getPropertyValue('--ly')) }; })()`);
const ok = (name) => console.log('✅', name);
const W = 1440, H = 900;

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/lens` });
  await waitFor("document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35 && document.querySelector('.lens-veil')?.dataset.on==='true'", 90000);
  await sleep(600);

  // 1. 停在上方中间，然后离开窗口：光圈留在上边缘
  await move(720, 2);
  await sleep(900);
  let p = await ring();
  assert.ok(Math.abs(p.x - 720) < 4 && Math.abs(p.y - 2) < 4, `应停在上边缘：${JSON.stringify(p)}`);
  await leaveWindow();
  await sleep(900);
  p = await ring();
  assert.ok(Math.abs(p.x - 720) < 4 && Math.abs(p.y - 2) < 4, `离开窗口后应停在最后位置，不回中心：${JSON.stringify(p)}`);
  ok('离开窗口：光圈停在最后位置（不回中心）');

  // 2. 从右上角重新进入：平滑移到新位置
  await move(W - 2, 2);
  await sleep(900);
  p = await ring();
  assert.ok(Math.abs(p.x - (W - 2)) < 4, `重新进入后应到右上角：${JSON.stringify(p)}`);
  ok('从右上角进入：光圈移到新位置');

  // 3. 边缘快速来回：离开 / 进入交替 30 次，采样光圈位置，不得弹回中心
  const samples = [];
  for (let i = 0; i < 30; i++) {
    await leaveWindow();
    await sleep(16);
    await move(i % 2 ? 1430 : 1436, 100 + (i % 3) * 6);
    samples.push(await ring());
    await sleep(16);
  }
  await sleep(600);
  samples.push(await ring());
  const minX = Math.min(...samples.map((s) => s.x));
  const maxY = Math.max(...samples.map((s) => s.y));
  assert.ok(minX > 1200, `快速来回时光圈不应弹回中心（最小 x=${minX.toFixed(0)}）`);
  assert.ok(maxY < 300, `快速来回时光圈不应滑到中间（最大 y=${maxY.toFixed(0)}）`);
  ok(`边缘快速来回 30 次：光圈始终在右侧边缘（x ≥ ${minX.toFixed(0)}）`);

  assert.deepEqual(browser.pageErrors, [], `页面异常：${browser.pageErrors.join('\n')}`);
  console.log('\n边缘门禁通过');
} catch (error) {
  console.error('❌', error.message);
  process.exitCode = 1;
} finally { browser.close(); }
