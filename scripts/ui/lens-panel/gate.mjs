import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';
const origin = process.env.SITE_ORIGIN ?? 'http://127.0.0.1:3123';
const out = 'reviews/evidence/p23-lens';
await mkdir(out, { recursive: true });
const browser = await openTracksBrowser(origin), { send, evaluate } = browser;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const baseline = JSON.parse(await readFile(`${out}/baseline/metrics.json`, 'utf8'))[0].rect.height;
const check = (name, value) => { assert.ok(value, name); results.push(name); };
try {
  await send('Page.enable'); await send('Runtime.enable');
  for (const [width, height, mobile] of [[1440, 900, false], [390, 844, true], [375, 667, true]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 });
    await send('Page.navigate', { url: `${origin}/lens?track=4` }, 120_000);
    const end = Date.now() + 60_000;
    while (Date.now() < end && !(await evaluate(`document.querySelector('.lens-panel')?.dataset.placed==='true'`))) await sleep(200);
    await sleep(400);
    let info = await evaluate(`(()=>{const p=document.querySelector('.lens-panel'),r=p.getBoundingClientRect();return {height:r.height,top:r.top,bottom:r.bottom,chains:p.querySelectorAll('.lens-chain').length}})()`);
    console.log(width, JSON.stringify(info), '基线', baseline);
    check(`${width} 面板在视口内且两链各一张卡`, info.chains === 2 && info.top >= 63 && info.bottom <= height);
    check(`${width} 高度预算`, mobile ? info.height <= 64 : info.height <= baseline * .7);
    if (mobile) await evaluate(`document.querySelector('.lens-drawer__collect').click()`);
    await sleep(200);
    const invalid = await evaluate(`[...document.querySelectorAll('.lens-panel button,.lens-panel a')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9)}).map(e=>e.className)`);
    check(`${width} 所有可见操作热区至少44px`, invalid.length === 0);
    const fonts = await evaluate(`[...new Set([...document.querySelectorAll('.lens-panel *')].filter(e=>e.getBoundingClientRect().height>0&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>getComputedStyle(e).fontSize))]`);
    check(`${width} 字号只有11/12/16`, fonts.every(x => ['11px', '12px', '16px'].includes(x)));
    await evaluate(`window.__p23MintNode=document.querySelector('.lens-login'); window.__p23Chain=document.querySelector('.lens-chain'); true;`);
    await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__p23Copied=value}}});document.querySelector('.lens-chain button[aria-label]').click()`);
    await sleep(50);
    check(`${width} 合约复制完整值并播报`, await evaluate(`window.__p23Copied===document.querySelector('.lens-chain code').title&&document.querySelector('.lens-chain button[aria-label]').textContent.includes('✓')&&document.querySelector('.lens-chain [aria-live]').textContent.length>0`));
    await evaluate(`const extra=document.createElement('div');extra.id='p23-overflow';extra.style.height='1200px';document.querySelectorAll('.lens-chain')[1].append(extra)`);
    await sleep(300);
    check(`${width} 超高内容可内部滚动到底`, await evaluate(`(()=>{const p=document.querySelector('.lens-panel');p.scrollTop=p.scrollHeight;return p.scrollHeight>p.clientHeight&&p.scrollTop>100&&p.scrollTop+p.clientHeight>=p.scrollHeight-2})()`));
    await evaluate(`document.querySelector('#p23-overflow').remove();document.querySelector('.lens-panel').scrollTop=0`);
    if (mobile) {
      await evaluate(`document.querySelector('.lens-drawer__handle').click();document.querySelector('.lens-drawer__handle').click()`);
      await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
      await sleep(150);
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
      await sleep(150);
      check(`${width} 折叠展开跨断点保持同一DOM`, await evaluate(`window.__p23MintNode===document.querySelector('.lens-login')&&window.__p23Chain===document.querySelector('.lens-chain')`));
    }
  }
  await writeFile(`${out}/panel-gate.json`, JSON.stringify({ passed: true, results }, null, 2));
  console.log(`${results.length} 项详情面板断言通过`);
} catch (error) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${out}/panel-gate-failure.png`, Buffer.from(data, 'base64'));
  await writeFile(`${out}/panel-gate.json`, JSON.stringify({ passed: false, results, error: String(error) }, null, 2));
  console.error(error); process.exitCode = 1;
} finally { browser.close(); }
