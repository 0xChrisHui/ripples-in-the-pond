// /lens 面板的中英桌面与手机截图、字号、热区和滚动证据。
import { mkdir, writeFile } from 'node:fs/promises';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';
const origin = process.env.SITE_ORIGIN ?? 'http://127.0.0.1:3123';
const phase = process.argv[2] ?? 'baseline', out = `reviews/evidence/p23-lens/${phase}`;
await mkdir(out, { recursive: true });
const browser = await openTracksBrowser(origin), { send, evaluate } = browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), metrics = [];
try {
  await send('Page.enable'); await send('Runtime.enable');
  for (const lang of ['zh', 'en']) for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true], ['small', 375, 667, true]]) {
    await send('Network.setCookie', { name: 'locale', value: lang, url: origin });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 });
    await send('Page.navigate', { url: `${origin}/lens?track=4` }, 120_000);
    const end = Date.now() + 90_000;
    while (Date.now() < end && !(await evaluate(`document.querySelector('.lens-panel')?.dataset.placed==='true'`))) await sleep(250);
    await sleep(700);
    for (const expanded of mobile && phase !== 'baseline' ? [false, true] : [false]) {
      if (expanded) { await evaluate(`document.querySelector('.lens-drawer__handle')?.click()`); await sleep(300); }
      const prefix = `${name}-${lang}-${expanded ? 'expanded' : 'collapsed'}`;
      const info = await evaluate(`(() => { const p=document.querySelector('.lens-panel'); if(!p)return null;
        const r=p.getBoundingClientRect(),style=getComputedStyle(p), els=[...p.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
        return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},width:innerWidth,height:innerHeight,fonts:[...new Set(els.filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>getComputedStyle(e).fontSize))],background:style.backgroundColor,chainCount:p.querySelectorAll('.lens-chain').length,controls:els.filter(e=>e.matches('button,a')).map(e=>({text:e.textContent,label:e.getAttribute('aria-label'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,expanded:p.dataset.expanded,text:p.textContent};})()`);
      metrics.push({ prefix, ...info });
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, 120_000);
      await writeFile(`${out}/${prefix}.png`, Buffer.from(data, 'base64'));
      console.log(prefix, info?.rect);
    }
  }
  await writeFile(`${out}/metrics.json`, JSON.stringify(metrics, null, 2));
} finally { browser.close(); }
