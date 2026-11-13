// 用面板透明底叠在纯白背景上的最坏情况计算文字对比度，并读回35球颜色。
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';
const b = await openTracksBrowser('http://127.0.0.1:3123');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const luminance = rgb => rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0);
const composite = (fg, alpha, bg) => fg.map((x, i) => x * alpha + bg[i] * (1 - alpha));
const ratio = (a, c) => (Math.max(luminance(a), luminance(c)) + .05) / (Math.min(luminance(a), luminance(c)) + .05);
try {
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.send('Page.navigate', { url: 'http://127.0.0.1:3123/lens?track=4' }, 120_000);
  const end = Date.now() + 60_000;
  while (Date.now() < end && !(await b.evaluate(`document.querySelector('.lens-panel')?.dataset.placed==='true'`))) await sleep(200);
  const colors = await b.evaluate(`Array.from(document.querySelectorAll('.pond-home-surface button[data-render-node-id]')).map(el=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.node?.color)f=f.return;return {id:el.dataset.renderNodeId,color:f?.memoizedProps?.node?.color}})`);
  assert.equal(colors.length, 35); assert.ok(colors.every(x => /^#[\da-f]{6}$/i.test(x.color)));
  const background = composite([1, 7, 6], .84, [255, 255, 255]);
  const minimumText = composite([214, 226, 214], .76, background);
  const textContrast = ratio(minimumText, background);
  assert.ok(textContrast >= 4.5);
  const visible = colors.map(x => { const rgb = [1, 3, 5].map(n => parseInt(x.color.slice(n, n + 2), 16)); return { ...x, tint: composite(rgb, .65, [255, 255, 255]) }; });
  assert.ok(visible.every(x => Math.max(...x.tint) >= 89));
  const result = { passed: true, backgroundAssumption: '纯白背景透过84%墨色面板，为最坏亮度上界', minimumTextOpacity: .76, textContrast, colors: visible };
  await writeFile('reviews/evidence/p23-lens/contrast-colors.json', JSON.stringify(result, null, 2));
  console.log(`最坏白底文字对比度 ${textContrast.toFixed(2)}:1；35球颜色提亮边界通过`);
} finally { b.close(); }
