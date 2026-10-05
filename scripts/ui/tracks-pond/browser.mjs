import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { connectCdp } from '../../p15/browser/runtime-cdp.mjs';

const cdpBase = 'http://127.0.0.1:9335';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** 复用同一端口和 profile；只清理本次自己启动的浏览器。 */
export async function openTracksBrowser(origin) {
  let browser;
  try {
    try { await fetch(`${cdpBase}/json/version`, { signal: AbortSignal.timeout(1500) }); } catch {
      browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
        '--remote-debugging-port=9335', `--user-data-dir=${join(process.cwd(), '.next/tracks-browser-profile')}`, 'about:blank',
      ], { stdio: 'ignore', windowsHide: true });
      for (let i = 0; i < 40; i++) {
        try { if ((await fetch(`${cdpBase}/json/version`)).ok) break; } catch {}
        await sleep(100);
      }
    }
    const targets = await (await fetch(`${cdpBase}/json`)).json();
    if (!targets.some(item => item.type === 'page' && (item.url === 'about:blank' || item.url.startsWith(origin))))
      await fetch(`${cdpBase}/json/new?about:blank`, { method: 'PUT' });
    const cdp = await connectCdp(cdpBase, origin);
    return { ...cdp, close(keepOpen = false) { cdp.close(); if (!keepOpen) browser?.kill(); } };
  } catch (error) { browser?.kill(); throw error; }
}

/** 只观察既有渲染器；不创建测试 Canvas、不替换产品水面。 */
export async function observeWater(cdp) {
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args) {
      const context=getContext.call(this,kind,...args);
      if (context && /^webgl/.test(kind) && !this.__tracksContext) {
        this.__tracksContext=context; this.__tracksDraws=0;
        for (const method of ['drawArrays','drawElements']) {
          const draw=context[method].bind(context); const canvas=this;
          context[method]=(...values)=>{ canvas.__tracksDraws++; return draw(...values); };
        }
      }
      return context;
    };
  })();` });
}
