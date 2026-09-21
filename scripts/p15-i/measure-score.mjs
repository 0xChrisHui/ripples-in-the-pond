import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { connectCdp } from '../p15/browser/runtime-cdp.mjs';

const cdpBase = process.env.P15_CDP_URL ?? 'http://127.0.0.1:9341';
const siteBase = (process.env.P15_SITE_URL ?? 'https://pond-ripple.xyz').replace(/\/$/, '');
const bypassSecret = process.env.P15_BYPASS_SECRET;
const output = process.env.P15_OUTPUT ?? 'reviews/evidence/p15-i/i0-production-baseline.json';
const tokens = (process.env.P15_SCORE_TOKENS ?? '1,2,3,4,1,2,3,4,2,3')
  .split(',').map(Number).filter((value) => Number.isSafeInteger(value) && value > 0);

function errorText(error) { return error instanceof Error ? error.message : String(error); }
function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}
async function waitFor(cdp, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const value = await cdp.evaluate(expression); if (value) return value; }
    catch (error) { if (/CDP|WebSocket/.test(errorText(error))) throw error; }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${label} 超过 ${timeoutMs}ms`);
}
async function click(cdp, selector) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => { const node=document.querySelector(${JSON.stringify(selector)});
      if(!node||node.disabled)return false;node.click();return true;})()`,
    returnByValue: true, userGesture: true,
  });
  if (!result.result.value) throw new Error(`${selector} 尚不可点击`);
}
async function clickWhenHandled(cdp, selector, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const before = await cdp.evaluate("performance.getEntriesByName('p15:audio-intent').length");
    try { await click(cdp, selector); } catch { /* 水合或按钮状态尚未就绪 */ }
    await new Promise((resolve) => setTimeout(resolve, 80));
    const after = await cdp.evaluate("performance.getEntriesByName('p15:audio-intent').length");
    if (after > before) return;
  }
  throw new Error(`${selector} 未在 ${timeoutMs}ms 内接收播放意图`);
}
async function sample(cdp, tokenId, classification, index) {
  const origin = new URL(siteBase).origin;
  if (classification === 'cold') {
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'cache_storage' });
  }
  const starts = { console: cdp.consoleErrors.length, page: cdp.pageErrors.length };
  try {
    await cdp.send('Page.navigate', { url: `${siteBase}/score/${tokenId}?__p15_i=${Date.now()}` });
    const shellAt = await waitFor(cdp,
      `location.pathname==='/score/${tokenId}'&&document.querySelector('.record-anchor')?performance.now():0`,
      30_000, `Score #${tokenId} 页面主体`);
    await clickWhenHandled(cdp, '.record-anchor__action', 5_000);
    await waitFor(cdp, `performance.getEntriesByName('p15:first-sound-scheduled').length>0
      ||document.querySelector('main')?.dataset.playbackState==='error'`, 45_000, `Score #${tokenId} 首声排程`);
    const beforeClick = await cdp.evaluate(`(() => { const main=document.querySelector('main');
      const nav=performance.getEntriesByType('navigation')[0];
      return { state:main?.dataset.playbackState??null, shellAt:${shellAt}, responseStart:nav?.responseStart??null,
        domContentLoaded:nav?.domContentLoadedEventEnd??null,
        resourceLoadMs:Number(main?.dataset.resourceLoadMs)||null,
        audioResources:performance.getEntriesByType('resource').filter((item)=>
          item.name.includes('/media/')||item.name.includes('ardrive.net')||item.name.includes('arweave'))
          .map((item)=>({name:item.name,duration:item.duration,transferSize:item.transferSize})) }; })()`);
    const afterClick = await cdp.evaluate(`(() => { const main=document.querySelector('main');
      const mark=(name)=>performance.getEntriesByName(name).at(-1)?.startTime??null;
      const intent=mark('p15:audio-intent'),scheduled=mark('p15:first-sound-scheduled');
      return {state:main?.dataset.playbackState??null,decodeMs:Number(main?.dataset.decodeMs)||null,
        firstSoundExpectedMs:Number(main?.dataset.firstSoundExpectedMs)||null,
        startupClosureAt:mark('p15:score-startup-closure-ready'),
        allResourcesAt:mark('p15:score-all-resources-ready'),
        intentToScheduledMs:intent==null||scheduled==null?null:scheduled-intent,
        shellToScheduledMs:scheduled==null?null:scheduled-${shellAt}};})()`);
    return { classification, index, tokenId, beforeClick, afterClick,
      consoleErrors: cdp.consoleErrors.slice(starts.console), pageErrors: cdp.pageErrors.slice(starts.page) };
  } catch (error) {
    return { classification, index, tokenId, error: errorText(error),
      consoleErrors: cdp.consoleErrors.slice(starts.console), pageErrors: cdp.pageErrors.slice(starts.page) };
  }
}
function summary(samples) {
  const values = (path) => samples.map(path).filter(Number.isFinite);
  const load = values((item) => item.beforeClick?.resourceLoadMs);
  const first = values((item) => item.afterClick?.firstSoundExpectedMs);
  const perceived = values((item) => item.afterClick?.shellToScheduledMs);
  const shell = values((item) => item.beforeClick?.shellAt);
  return { requested: samples.length, valid: samples.filter((item) => !item.error).length,
    shellP50Ms: percentile(shell, .5), shellP95Ms: percentile(shell, .95),
    resourceP50Ms: percentile(load, .5), resourceP95Ms: percentile(load, .95),
    firstSoundP50Ms: percentile(first, .5), firstSoundP95Ms: percentile(first, .95),
    shellToSoundP50Ms: percentile(perceived, .5), shellToSoundP95Ms: percentile(perceived, .95), samples };
}

const report = { schema: 'p15-i.score-start.v2', measuredAt: new Date().toISOString(), siteBase,
  cacheBoundary: 'cold 每次清 HTTP/Cache Storage；hot 连续完整导航且不清缓存', cold: null, hot: null };
let cdp;
try {
  cdp = await connectCdp(cdpBase, siteBase);
  await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']
    .map((method) => cdp.send(method)));
  if (bypassSecret) await cdp.send('Network.setExtraHTTPHeaders', {
    headers: { 'x-vercel-protection-bypass': bypassSecret },
  });
  const cold = [];
  for (let index = 0; index < tokens.length; index += 1) cold.push(await sample(cdp, tokens[index], 'cold', index + 1));
  const hot = [];
  for (let index = 0; index < tokens.length; index += 1) hot.push(await sample(cdp, tokens[index], 'hot', index + 1));
  report.cold = summary(cold); report.hot = summary(hot);
  report.pass = report.cold.valid === tokens.length && report.hot.valid === tokens.length;
} catch (error) { report.fatalError = errorText(error); report.pass = false; }
finally {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  cdp?.close();
}
console.log(`已写入 ${output}；cold 首声 p95=${report.cold?.firstSoundP95Ms ?? 'N/A'}ms；hot=${report.hot?.firstSoundP95Ms ?? 'N/A'}ms`);
if (!report.pass) process.exitCode = 1;
