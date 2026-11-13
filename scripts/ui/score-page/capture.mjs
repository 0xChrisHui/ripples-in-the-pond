// 作品页与共享字体页面的中英、桌面/手机截图及布局证据。
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = process.env.SITE_ORIGIN ?? 'http://127.0.0.1:3123';
const phase = process.argv[2] ?? 'baseline';
const out = `reviews/evidence/p23-score/${phase}`;
const pages = process.argv.includes('--quick') ? ['/score/1', '/score/5']
  : ['/score/1', '/score/5', '/me', '/artist', '/echo', '/tracks', '/p23-missing-page', '/'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(out, { recursive: true });
const browser = await openTracksBrowser(origin);
const { send } = browser;
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 120_000);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const metrics = await readFile(`${out}/metrics.json`, 'utf8').then(JSON.parse).catch(() => []);
try {
  await send('Page.enable'); await send('Runtime.enable');
  for (const locale of ['zh', 'en']) for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    await send('Network.setCookie', { name: 'locale', value: locale, url: origin });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 });
    for (const route of pages) {
      const prefix = `${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-${name}-${locale}`;
      if (metrics.some((item) => item.prefix === prefix)) continue;
      await send('Page.navigate', { url: `${origin}${route}` }, 120_000);
      const end = Date.now() + 90_000;
      while (Date.now() < end) {
        const ready = await evaluate(`document.readyState!=='loading' && ${route.startsWith('/score/') ? "['ready','failed','processing'].includes(document.querySelector('[data-score-state]')?.dataset.scoreState)" : 'Boolean(document.querySelector("main"))'}`);
        if (ready) break;
        await sleep(300);
      }
      await sleep(1200);
      await evaluate('Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))])');
      if (phase === 'font-b') await evaluate(`document.documentElement.style.setProperty('--p11-font-display','var(--font-azeret-mono),monospace'); document.documentElement.style.setProperty('--p11-font-body','var(--font-azeret-mono),monospace');`);
      const data = await evaluate(`(() => {
        const rect=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {tag:e.tagName,text:e.textContent?.slice(0,120),x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,fontFamily:s.fontFamily,display:s.display}};
        return {route:location.pathname,lang:document.documentElement.lang,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,state:document.querySelector('[data-score-state]')?.dataset.scoreState,h1:[...document.querySelectorAll('h1')].map(rect),hero:[...document.querySelectorAll('.score-pond-page__identity,.score-pond-page__anchor,.score-share-actions')].map(rect),oldHeaders:document.querySelectorAll('.score-pond-header').length,ledgerOpen:document.querySelector('.score-archive details')?.open??null};})()`);
      metrics.push({ ...data, prefix });
      for (let y = 0, n = 0; y < Math.min(data.height, 5000); y += height, n++) {
        await evaluate(`scrollTo(0,${y})`); await sleep(100);
        const { data: png } = await send('Page.captureScreenshot', { format: 'png' }, 120_000);
        await writeFile(`${out}/${prefix}-${n}.png`, Buffer.from(png, 'base64'));
      }
      if (route.startsWith('/score/')) {
        await evaluate('scrollTo(0,0); document.querySelector(".score-share-actions summary")?.click()');
        await sleep(150);
        const { data: png } = await send('Page.captureScreenshot', { format: 'png' }, 120_000);
        await writeFile(`${out}/${prefix}-share.png`, Buffer.from(png, 'base64'));
      }
      console.log(prefix, data.state ?? '', data.height);
      await writeFile(`${out}/metrics.json`, JSON.stringify(metrics, null, 2));
    }
  }
} finally { browser.close(); }
