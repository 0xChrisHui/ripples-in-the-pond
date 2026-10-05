import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openTracksBrowser, observeWater } from './tracks-pond/browser.mjs';
const origin = process.env.TRACKS_TEST_ORIGIN ?? 'http://127.0.0.1:3121';
const output = join(process.cwd(), 'reviews/evidence/tracks-redesign');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const reviewPass = process.env.TRACKS_POND_REVIEW_PASS;
const remaining = Boolean(reviewPass);
const cdp = await openTracksBrowser(origin);
const { send, evaluate } = cdp;
const evidence = remaining ? JSON.parse(await readFile(join(output, 'browser-pond-v6.failure.json'), 'utf8'))
  : { measuredAt: new Date().toISOString(), origin };
if (remaining) { const occurredAt = { after: evidence.resumedAt ?? evidence.measuredAt, before: new Date().toISOString() };
  evidence.resumedAt = occurredAt.before; delete evidence.failure; delete evidence.runtime;
  if (evidence.consoleErrors?.length) evidence.consoleLimitations = evidence.consoleErrors.map(message =>
    ({ message, occurredAt, rootCause: '未复现，根因未确定；未将整段浏览器运行标为无错误' })); }
const copyToRemove = ['35 封写给时间的回信', '声音之外', '作者的文字，保留原来的样子。',
  '读到这里，让下一首继续。', '下一封回信', '35 首原曲 · 声音与记忆',
  '选择一首，留一点时间给声音。', '声音的刻印', '取自这首录音'];
async function waitFor(expression, limit = 45000) {
  const deadline = Date.now() + limit;
  while (Date.now() < deadline) {
    try { if (await evaluate(expression)) return; } catch (error) {
      if (!/context.*destroyed|Cannot find context|navigated/i.test(error.message)) throw error;
    }
    await sleep(100);
  }
  throw new Error(`页面条件未满足：${expression}`);
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(output, `${name}.png`), Buffer.from(result.data, 'base64'));
}
async function settle(path, owner) {
  await waitFor(`location.pathname === ${JSON.stringify(path)} &&
    document.querySelector('[data-pond-shell]')?.dataset.pondCurrent === ${JSON.stringify(owner)} &&
    document.querySelector('[data-pond-shell]')?.dataset.pondStage === 'stable'`);
}
async function click(selector) {
  assert.ok(await evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)});
    if (!node) return false; node.click(); return true; })()`), `链接存在：${selector}`);
}
async function waterReady() {
  await waitFor(`document.querySelector('[data-gl-health]')?.dataset.glHealth === 'healthy' &&
    document.querySelector('[data-pond-shell]')?.dataset.pondSceneReady === 'true' &&
    !!document.querySelector('[data-pond-shell] canvas')?.__tracksContext`);
}
async function markWater() {
  return evaluate(`(() => { const shell=document.querySelector('[data-pond-shell]');
    const canvas=shell.querySelector('canvas'); window.__tracksWater={ shell, canvas,
      context:canvas.__tracksContext, mountId:shell.dataset.pondMountId,
      canvasCount:document.querySelectorAll('canvas').length, draws:canvas.__tracksDraws ?? 0 };
    return { mountId:window.__tracksWater.mountId, canvasCount:window.__tracksWater.canvasCount }; })()`);
}
async function continuity(owner) {
  if (owner === 'tracks') await waitFor(`!!document.querySelector('[data-scene-presence]') &&
    Number(document.querySelector('[data-scene-presence]').dataset.scenePresence) === 0`, 3000);
  const value = await evaluate(`(() => { const shell=document.querySelector('[data-pond-shell]');
    const canvas=shell?.querySelector('canvas'); const base=window.__tracksWater;
    const context=canvas?.__tracksContext;
    return { sameShell:shell===base.shell, sameCanvas:canvas===base.canvas, sameContext:context===base.context,
      mountId:shell?.dataset.pondMountId, baselineMountId:base.mountId, scene:shell?.dataset.pondScene,
      canvasCount:document.querySelectorAll('canvas').length, baselineCount:base.canvasCount,
      glCanvases:[...document.querySelectorAll('canvas')].filter(item=>item.__tracksContext).length,
      contextLost:context?.isContextLost(), draws:(canvas?.__tracksDraws ?? 0)-base.draws,
      bufferWidth:context?.drawingBufferWidth, presence:document.querySelector('[data-scene-presence]')
        ? Number(document.querySelector('[data-scene-presence]').dataset.scenePresence) : null,
      activeOwners:document.querySelectorAll(['.pond-home-surface[data-active="true"][data-interactive="true"]',
        '.pond-route-surface[data-active="true"][data-interactive="true"]',
        '.pond-prepared-archive[data-active="true"][data-interactive="true"]'].join(',')).length }; })()`);
  assert.ok(value.sameShell && value.sameCanvas && value.sameContext, '转场复用同一外壳、Canvas 和 WebGL context');
  assert.equal(value.mountId, value.baselineMountId);
  assert.equal(value.canvasCount, value.baselineCount); assert.equal(value.glCanvases, 1);
  assert.equal(value.contextLost, false); assert.ok(value.bufferWidth > 0 && value.draws > 0, '真实 GL 持续绘制');
  assert.equal(value.scene, owner); assert.equal(value.activeOwners, 1, '只允许一个路由接管交互');
  if (owner === 'tracks') assert.equal(value.presence, 0, '曲目背景不显示首页圆圈');
  return value;
}
async function layout() {
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(650);
  const value = await evaluate(`(() => { const main=document.querySelector('.track-archive');
    const rect=main.querySelector('.material-player__action').getBoundingClientRect();
    return { width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth,
      playTop:rect.top, playBottom:rect.bottom, items:main.querySelectorAll('[data-track-index-item]').length,
      selected:main.dataset.selectedTrack, phase:main.querySelector('.material-player').dataset.phase,
      copy:main.innerText }; })()`);
  assert.equal(value.items, 35); assert.equal(value.phase, 'idle');
  assert.ok(value.playTop >= 0 && value.playBottom <= value.height, '首屏可直接播放');
  assert.ok(value.scrollWidth <= value.width, '没有横向溢出');
  for (const copy of copyToRemove) assert.ok(!value.copy.includes(copy), `不再显示加戏文案：${copy}`);
  delete value.copy;
  return value;
}
try {
  await mkdir(output, { recursive: true });
  await send('Page.enable'); await send('Runtime.enable');
  await observeWater(cdp);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if (reviewPass !== 'note') {
  if (!remaining) {
  await send('Page.navigate', { url: `${origin}/?tracks=pond` });
  await settle('/', 'home'); await waterReady();
  evidence.baseline = await markWater();
  await waitFor(`!!document.querySelector('a[href="/tracks/pond"]')`);
  await click('a[href="/tracks/pond"]'); await settle('/tracks/pond', 'tracks');
  evidence.desktop = await layout(); evidence.enter = await continuity('tracks');
  await shot('desktop-pond-v6');
  await click('[data-track-index-item="35"]');
  await waitFor(`document.querySelector('.track-archive')?.dataset.selectedTrack === '35'`);
  assert.equal(await evaluate(`document.querySelector('[data-track-index-item="35"]').getAttribute('aria-current')`), 'true');
  await click('.track-header__back'); await settle('/', 'home');
  evidence.returnHome = await continuity('home');
  await click('a[href="/tracks/pond"]'); await settle('/tracks/pond', 'tracks');
  await click('[data-track-index-item="31"]');
  await click('a[href="/tracks?track=31"]');
  await waitFor(`location.pathname === '/tracks' && document.querySelector('.track-archive')?.dataset.selectedTrack === '31'`);
  evidence.archive = await layout();
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.track-archive')).backgroundColor`), 'rgb(16, 29, 25)');
  await click('a[href="/tracks/pond?track=31"]'); await settle('/tracks/pond', 'tracks'); await waterReady();
  assert.equal(await evaluate(`document.querySelector('.track-archive').dataset.selectedTrack`), '31');
  evidence.sameTrackComparison = true;
  } else {
    await send('Page.navigate', { url: `${origin}/tracks/pond?track=31` });
    await settle('/tracks/pond', 'tracks'); await waterReady();
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor(`document.querySelector('[data-pond-shell]')?.dataset.pondReducedSceneMotion === 'true'`);
  evidence.reducedBaseline = await markWater();
  await click('.track-header__back'); await settle('/', 'home');
  await click('a[href="/tracks/pond"]'); await settle('/tracks/pond', 'tracks');
  evidence.reducedMotion = await continuity('tracks');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sound-imprint')).animationName`), 'none');
  }
  await send('Emulation.setEmulatedMedia', { features: [] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `${origin}/tracks/pond?track=1` });
  await settle('/tracks/pond', 'tracks'); await waterReady();
  if (reviewPass !== 'note') {
  evidence.mobile = await layout(); await shot('mobile-pond-v6');
  await click('.track-index__toggle'); await click('[data-track-index-item="35"]');
  await waitFor(`document.querySelector('.track-archive')?.dataset.selectedTrack === '35'`);
  assert.equal(await evaluate(`document.querySelector('.track-index').dataset.open`), 'false');
  evidence.mobileGrid = true;
  }
  await click('.track-index__toggle'); await click('[data-track-index-item="31"]');
  await waitFor(`document.querySelector('.track-archive')?.dataset.selectedTrack === '31'`);
  await evaluate(`document.querySelector('#track-story').scrollIntoView()`); await sleep(300);
  evidence.mobileNote = await evaluate(`(() => { const rect=document.querySelector('.track-story__copy p').getBoundingClientRect();
    return { top:rect.top, bottom:rect.bottom, width:rect.width, viewport:innerWidth, height:innerHeight,
      overflow:document.documentElement.scrollWidth>innerWidth }; })()`);
  assert.ok(evidence.mobileNote.top >= 0 && evidence.mobileNote.top < evidence.mobileNote.height);
  assert.ok(evidence.mobileNote.width <= evidence.mobileNote.viewport && !evidence.mobileNote.overflow);
  await shot('mobile-note-pond-v6');
  evidence.apiTracksReadback = await evaluate(`fetch('/api/tracks').then(response=>({status:response.status,degraded:response.headers.get('x-degraded')}))`);
  assert.equal(evidence.apiTracksReadback.status, 200); assert.equal(evidence.apiTracksReadback.degraded, null);
  assert.deepEqual(cdp.pageErrors, []); assert.deepEqual(cdp.consoleErrors, [], '浏览器无异常');
  evidence.pageErrors = cdp.pageErrors; evidence.consoleErrors = cdp.consoleErrors;
  await writeFile(join(output, 'browser-pond-v6.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  evidence.failure = error.stack;
  evidence.runtime = await evaluate(`(() => { const shell=document.querySelector('[data-pond-shell]');
    return { path:location.pathname, shell:shell ? { ...shell.dataset } : null,
      main:document.querySelector('.track-archive')?.dataset.selectedTrack,
      canvasCount:document.querySelectorAll('canvas').length }; })()`).catch(() => null);
  evidence.pageErrors = cdp.pageErrors; evidence.consoleErrors = cdp.consoleErrors;
  await writeFile(join(output, 'browser-pond-v6.failure.json'), JSON.stringify(evidence, null, 2));
  throw error;
} finally { cdp.close(); }
