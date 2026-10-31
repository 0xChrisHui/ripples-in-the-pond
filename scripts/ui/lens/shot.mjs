// 截图 /lens 面板与遮罩（无头 Edge 画不出 WebGL 球，球位置只在 DOM 里）：node scripts/ui/lens/shot.mjs [origin] [lang]
import { writeFile } from 'node:fs/promises';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3123';
const lang = process.argv[3] ?? 'zh';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name, width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await send('Page.navigate', { url: `${origin}/lens` });
  const end = Date.now() + 60000;
  while (Date.now() < end && !(await evaluate("document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35 && document.querySelector('.lens-veil')?.dataset.on==='true'"))) await sleep(200);
  await sleep(800);
  const ball = await evaluate(`(() => { for (const n of document.querySelectorAll('.pond-home-surface button[data-render-node-id]')) { if (n.style.pointerEvents==='none') continue;
    const r=n.getBoundingClientRect(); if (r.width>8 && r.top>130 && r.bottom<innerHeight-80 && r.left>60 && r.right<innerWidth-60) return {x:r.x+r.width/2,y:r.y+r.height/2}; } return null; })()`);
  if (mobile) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [ball] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...ball });
  await sleep(1200);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`reviews/evidence/lens-${name}-${lang}.png`, Buffer.from(data, 'base64'));
  console.log('saved', name, JSON.stringify(ball));
}
try {
  await send('Page.enable'); await send('Runtime.enable');
  if (lang === 'en') await send('Network.setCookie', { name: 'NEXT_LOCALE', value: 'en', url: origin }).catch(() => {});
  await shot('desktop', 1440, 900, false);
  await shot('phone', 390, 844, true);
} finally {
  await send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
  browser.close();
}
