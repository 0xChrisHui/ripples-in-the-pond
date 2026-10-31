// 首页不下载 /lens 功能层：生产构建下，/ 加载完成后的 JS 清单 vs 点「详情」后新增的 JS。node scripts/ui/lens/chunk-check.mjs [origin]
import assert from 'node:assert/strict';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3124';
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const scripts = () => evaluate("performance.getEntriesByType('resource').map(e => e.name).filter(n => /\\.js(\\?|$)/.test(n))");
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/` });
  const end = Date.now() + 60000;
  while (Date.now() < end && !(await evaluate("document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35"))) await sleep(200);
  await sleep(3000); // 空闲预热也算首页自己的资源
  const home = new Set(await scripts());
  const link = await evaluate(`(() => { const r=document.querySelector('.pond-global-header nav a[href="/lens"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...link, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...link, button: 'left', clickCount: 1 });
  const wait = Date.now() + 30000;
  while (Date.now() < wait && !(await evaluate("!!document.querySelector('.lens-veil')"))) await sleep(150);
  const added = (await scripts()).filter((name) => !home.has(name));
  console.log(`首页 JS ${home.size} 个；进入 /lens 后新增 ${added.length} 个`);
  assert.ok(await evaluate("!!document.querySelector('.lens-veil')"), '/lens 功能层应已挂载');
  assert.ok(added.length >= 1, '功能层应以独立 chunk 异步加载');
  console.log('✅ 首页未下载 /lens 功能层（点「详情」后才新增 chunk）');
} catch (error) { console.error('❌', error.message); process.exitCode = 1; } finally { browser.close(); }
