import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { connectCdp } from './runtime-cdp.mjs';
import { measureEchoRuntime } from './runtime-echo.mjs';

const cdpBase = process.env.P15_CDP_URL ?? 'http://127.0.0.1:9337';
const siteBase = (process.env.P15_SITE_URL ?? 'http://127.0.0.1:3015').replace(/\/$/, '');
const output = process.env.P15_OUTPUT ?? 'reviews/evidence/p15-final/runtime-integrated.json';
const sampleMs = 10_500;

function errorText(error) { return error instanceof Error ? error.message : String(error); }
function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}
async function waitFor(cdp, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const value = await cdp.evaluate(expression); if (value) return value; }
    catch (error) {
      if (/CDP|WebSocket/.test(errorText(error))) throw error;
      // 导航时 execution context 会短暂销毁。
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${label} 超过 ${timeoutMs}ms`);
}
async function navigate(cdp, path) {
  const joiner = path.includes('?') ? '&' : '?';
  await cdp.send('Page.navigate', { url: `${siteBase}${path}${joiner}__p15_runtime=${Date.now()}` });
  await waitFor(cdp, `location.pathname===${JSON.stringify(path.split('?')[0])}
    && Boolean(document.querySelector('main'))`, 30_000, `${path} 页面`);
}
async function buildIdentity() {
  let commit = null; let dirty = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
  } catch { /* 非 Git 环境仍保留浏览器证据。 */ }
  const nextBuildId = await readFile('.next/BUILD_ID', 'utf8').then((value) => value.trim()).catch(() => null);
  return { repositoryCommit: commit, worktreeDirty: dirty, nextBuildId };
}

const observerSource = `(() => {
  const rect = (value) => value ? ({x:value.x,y:value.y,width:value.width,height:value.height}) : null;
  const nodeName = (node) => node ? node.tagName.toLowerCase() + (node.id ? '#' + node.id : '')
    + [...node.classList].slice(0, 2).map((item) => '.' + item).join('') : null;
  const state = window.__p15Runtime = { frames: [], frameStartedAt: performance.now(),
    lastRafAt: performance.now(), longTasks: [], cls: 0, shifts: [],
    observerSupport: { longTask: false, layoutShift: false } };
  const frame = (now) => { state.frames.push(now-state.lastRafAt); state.lastRafAt=now; requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    state.longTasks.push({ startTime:entry.startTime, duration:entry.duration,
      attribution:(entry.attribution||[]).map((item) => ({ name:item.name,
        containerType:item.containerType, containerName:item.containerName,
        containerId:item.containerId, containerSrc:item.containerSrc })) });
  })).observe({type:'longtask',buffered:true}); state.observerSupport.longTask=true; } catch {}
  try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    if(entry.hadRecentInput)return; state.cls+=entry.value;
    state.shifts.push({ startTime:entry.startTime, value:entry.value,
      sources:(entry.sources||[]).map((item) => ({node:nodeName(item.node),
        previousRect:rect(item.previousRect),currentRect:rect(item.currentRect)})) });
  })).observe({type:'layout-shift',buffered:true}); state.observerSupport.layoutShift=true; } catch {}
})();`;

async function measureHome(cdp) {
  const starts = { console: cdp.consoleErrors.length, page: cdp.pageErrors.length };
  await navigate(cdp, '/');
  const glHealth = await waitFor(cdp, `(() => { const value=document.querySelector('main')?.dataset.glHealth;
    return ['healthy','lost','error','forced'].includes(value) ? value : null; })()`, 30_000, '首页 glHealth');
  const heapBefore = await cdp.send('Runtime.getHeapUsage');
  await cdp.evaluate(`Object.assign(window.__p15Runtime,
    {frames:[],frameStartedAt:performance.now(),lastRafAt:performance.now()})`);
  await new Promise((resolve) => setTimeout(resolve, sampleMs));
  const runtime = await cdp.evaluate(`({ ...window.__p15Runtime,
    sampleDurationMs:performance.now()-window.__p15Runtime.frameStartedAt,
    assets:[...new Set(performance.getEntriesByType('resource').map((item)=>item.name)
      .filter((url)=>url.includes('/_next/static/')).map((url)=>new URL(url).pathname))].sort() })`);
  const heapAfter = await cdp.send('Runtime.getHeapUsage');
  const frames = runtime.frames.filter((value) => Number.isFinite(value) && value >= 0);
  return { glHealth, observerSupport: runtime.observerSupport, assets: runtime.assets,
    documentRaf: { sampleDurationMs: runtime.sampleDurationMs, count: frames.length,
      rateHz: frames.length * 1000 / runtime.sampleDurationMs,
      p95DeltaMs: percentile(frames, .95), maxDeltaMs: Math.max(0, ...frames) },
    longTasks: runtime.longTasks,
    longestTaskMs: Math.max(0, ...runtime.longTasks.map((item) => item.duration)),
    cls: runtime.cls, layoutShifts: runtime.shifts,
    heap: { beforeBytes: heapBefore.usedSize, afterBytes: heapAfter.usedSize,
      deltaBytes: heapAfter.usedSize-heapBefore.usedSize },
    consoleErrors: cdp.consoleErrors.slice(starts.console), pageErrors: cdp.pageErrors.slice(starts.page) };
}

const report = { schemaVersion: 3, measuredAt: new Date().toISOString(), siteBase, cdpBase,
  identity: await buildIdentity() };
let cdp;
try {
  cdp = await connectCdp(cdpBase, siteBase);
  await Promise.all(['Page.enable','Runtime.enable','Log.enable','Performance.enable','Network.enable']
    .map((method) => cdp.send(method)));
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: observerSource });
  await cdp.send('Page.bringToFront');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  try { report.home = await measureHome(cdp); } catch (error) { report.home = { error: errorText(error) }; }
  try { report.echo = await measureEchoRuntime({ cdp, siteBase, navigate, waitFor }); }
  catch (error) {
    report.echo = { error: errorText(error), actualAudibilityVerified: false };
  }
} catch (error) { report.fatalError = errorText(error); }
finally {
  const home = report.home ?? {}; const echo = report.echo ?? {};
  const echoSamples = [echo.cold, ...(echo.hot?.samples ?? [])].filter(Boolean);
  report.checks = {
    identityPresent: Boolean(report.identity.repositoryCommit && report.identity.nextBuildId),
    glHealthy: home.glHealth === 'healthy',
    documentRafWindow: home.documentRaf?.sampleDurationMs >= 10_000 && home.documentRaf?.count > 0,
    longTaskObserver: home.observerSupport?.longTask === true,
    longestTask200: home.observerSupport?.longTask === true && home.longestTaskMs <= 200,
    layoutShiftObserver: home.observerSupport?.layoutShift === true,
    cls01: home.observerSupport?.layoutShift === true && home.cls <= .1,
    noHomeRuntimeErrors: !home.consoleErrors?.length && !home.pageErrors?.length,
    echoColdReady: echo.cold?.ui?.state === 'ready' && echo.cold.ui.actionDisabled === false,
    echoColdExpectedFirstSound2000: Number.isFinite(echo.cold?.playback?.expectedFirstSoundMs)
      && echo.cold.playback.expectedFirstSoundMs <= 2_000,
    echoHotTenValid: echo.hot?.requested === 10 && echo.hot.valid === 10
      && echo.hot.samples?.length === 10
      && echo.hot.samples.every((sample) => sample.ui?.state === 'ready' && !sample.error),
    echoHotP95ExpectedFirstSound500: Number.isFinite(echo.hot?.p95ExpectedFirstSoundMs)
      && echo.hot.p95ExpectedFirstSoundMs <= 500,
    noEchoRuntimeErrors: echoSamples.length === 11 && echoSamples.every((sample) =>
      !sample.consoleErrors?.length && !sample.pageErrors?.length),
  };
  report.pass = !report.fatalError && Object.values(report.checks).every(Boolean);
  try {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  } finally { cdp?.close(); }
}
console.log(`已写入 ${output}；Gate ${report.pass?'PASS':'FAIL'}；document RAF 非 GL FPS，实际听音未验证`);
if (!report.pass) process.exitCode = 1;
