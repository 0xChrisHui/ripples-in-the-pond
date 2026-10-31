// 遮罩亮度对比：同一画面在 / 与 /lens 的截图，比较光圈内与光圈外的平均亮度。node scripts/ui/lens/veil-check.mjs [origin]
import assert from 'node:assert/strict';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3123';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function ready(path) {
  await send('Page.navigate', { url: `${origin}${path}` });
  const end = Date.now() + 60000;
  while (Date.now() < end && !(await evaluate("document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35 && document.querySelector('[data-pond-shell]')?.dataset.pondSceneReady==='true'"))) await sleep(200);
  await sleep(1500);
}
async function shot() { return (await send('Page.captureScreenshot', { format: 'png' })).data; }
// 在页面里解码截图并取区域平均亮度
const luma = (b64, x, y, r) => evaluate(`new Promise((resolve) => { const img=new Image(); img.onload=() => { const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
  const g=c.getContext('2d'); g.drawImage(img,0,0); const d=g.getImageData(${x}-${r},${y}-${r},${r * 2},${r * 2}).data; let s=0; for (let i=0;i<d.length;i+=4) s+=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; resolve(s/(d.length/4)); };
  img.src='data:image/png;base64,${b64}'; })`);
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await ready('/');
  const base = await shot();
  await ready('/lens');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450 });
  await sleep(1200);
  const lens = await shot();
  const inBase = await luma(base, 720, 450, 40), inLens = await luma(lens, 720, 450, 40);
  const outBase = await luma(base, 1250, 700, 60), outLens = await luma(lens, 1250, 700, 60);
  console.log({ 光圈内: [inBase.toFixed(1), inLens.toFixed(1)], 光圈外: [outBase.toFixed(1), outLens.toFixed(1)] });
  assert.ok(inLens > inBase * 0.9, '光圈内应基本保持原亮度');
  assert.ok(outLens < outBase * 0.55, '光圈外应明显变暗（约 40%）');
  console.log('✅ 遮罩：光圈内保持原色，光圈外变暗');
} catch (error) { console.error('❌', error.message); process.exitCode = 1; } finally { browser.close(); }
