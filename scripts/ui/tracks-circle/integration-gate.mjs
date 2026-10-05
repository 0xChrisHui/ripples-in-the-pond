import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openTracksBrowser, observeWater } from '../tracks-pond/browser.mjs';

const origin = 'http://127.0.0.1:3121';
const output = join(process.cwd(), 'reviews/evidence/tracks-redesign');
const browser = await openTracksBrowser(origin);
const { evaluate, send } = browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const resume = Boolean(process.env.TRACKS_REMAINING);
const finishOnly = process.env.TRACKS_REMAINING === 'finish';
const evidence = resume ? JSON.parse(await readFile(join(output, 'browser-integration-v11.json'), 'utf8'))
  : { at: new Date().toISOString(), origin, reused: 'browser-integration-v10.json：音频身份、35首完整性、凭证链接及摘要高度未改变' };
delete evidence.failure;
let failed = false;
async function waitFor(expression, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(expression)) return; await sleep(100); }
  throw new Error('未满足条件：'+expression);
}
async function click(selector) {
  const point = await evaluate('(() => { const n=document.querySelector('+JSON.stringify(selector)+'); const r=n.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
const circle = "(() => { const n=document.querySelector('[data-track-circle]'); return {session:n.dataset.circleSession,dx:+n.dataset.circleDx,dy:+n.dataset.circleDy,time:+n.dataset.circleTime,color:n.dataset.circleColor,track:document.querySelector('.track-archive').dataset.selectedTrack}; })()";
const header = "(() => { const n=document.querySelector('.pond-global-header'); return n ? {left:n.getBoundingClientRect().left,top:n.getBoundingClientRect().top,links:[...n.querySelectorAll('nav a,nav button')].map(a=>({label:a.textContent.trim(),x:a.getBoundingClientRect().x,y:a.getBoundingClientRect().y})),back:n.querySelector('a').textContent.trim()} : null; })()";
async function route(selector, path, owner) {
  await click(selector);
  await waitFor("document.querySelector('[data-pond-shell]')?.dataset.pondInteractiveOwner==='"+owner+"'");
  const firstCircle = owner === 'tracks' ? await evaluate(circle) : null;
  await waitFor("location.pathname==='"+path+"' && document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'");
  assert.equal(await evaluate("document.querySelector('[data-pond-shell] canvas')===window.__water"), true);
  assert.equal(await evaluate("document.querySelector('[data-pond-shell]').dataset.pondInteractiveOwner"), owner);
  return firstCircle;
}
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, name+'-v11.png'), Buffer.from(data, 'base64'));
}
try {
  await send('Page.enable'); await send('Runtime.enable'); await observeWater(browser);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__media=[]; const original=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){if(!window.__media.includes(this))window.__media.push(this);return original.call(this);};" });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if (!finishOnly) {
  if (!resume || !(await evaluate("location.pathname==='/tracks'"))) await send('Page.navigate', { url: origin+'/tracks?track=7' });
  await waitFor("document.querySelector('[data-track-circle]')?.dataset.circleRenderer==='webgl'");
  await evaluate("window.__water=document.querySelector('[data-pond-shell] canvas');window.__circle=document.querySelector('[data-track-circle]');true");
  await waitFor("document.querySelector('.pond-global-header nav button')?.textContent==='登录'");
  evidence.tracksHeader = await evaluate(header); assert.ok(evidence.tracksHeader);
  await sleep(300); const before = await evaluate(circle);
  await route('.pond-global-header__home', '/', 'home'); evidence.homeHeader = await evaluate(header);
  const after = await route('.pond-global-header nav a[href="/tracks"]', '/tracks', 'tracks');
  evidence.reentry = { before, after };
  assert.equal(await evaluate("document.querySelector('[data-track-circle]')===window.__circle"), true);
  assert.equal(before.session, after.session); assert.equal(after.track, '7');
  assert.ok(after.time >= before.time); assert.equal(after.color, before.color);
  assert.ok(Math.hypot(after.dx-before.dx,after.dy-before.dy)<10, '只比较交接首刻，不能把等待路由期间的正常运动误当跳变');
  if (!resume) {
  await click('.material-player__action');
  await waitFor("document.querySelector('.material-player').dataset.phase==='playing'");
  await click('[data-track-index-item="8"]');
  await waitFor("document.querySelector('.track-archive').dataset.selectedTrack==='8' && document.querySelector('.material-player').dataset.phase==='playing'");
  evidence.autoplay = await evaluate("window.__media.filter(a=>!a.paused).map(a=>({src:a.currentSrc,time:a.currentTime}))");
  assert.equal(evidence.autoplay.length, 1); assert.ok(evidence.autoplay[0].src.includes('/tracks/No.8.mp3?v='));
  await click('.material-player__action'); await click('[data-track-index-item="7"]'); await sleep(200);
  assert.equal(await evaluate("document.querySelector('.material-player').dataset.phase"), 'idle');
  await route('.pond-global-header nav a[href="/artist"]', '/artist', 'artist'); evidence.artistHeader = await evaluate(header);
  await shot('artist-header');
  await route('.pond-global-header nav a[href="/tracks"]', '/tracks', 'tracks');
  }
  for (const current of [evidence.homeHeader, evidence.artistHeader]) assert.deepEqual(current.links, evidence.tracksHeader.links);
  assert.equal(evidence.artistHeader.back, '← 返回水塘');
  await evaluate("document.querySelector('.track-story__next').scrollIntoView({block:'center'})");
  evidence.seam = await evaluate("(() => { const story=document.querySelector('.track-story'),ledger=document.querySelector('.track-ledger'),reading=document.querySelector('.track-reading'); return {storyBackground:getComputedStyle(story).backgroundColor,ledgerBackground:getComputedStyle(ledger).backgroundColor,readingBackground:getComputedStyle(reading).backgroundColor,ledgerBorder:getComputedStyle(ledger).borderTopWidth}; })()");
  assert.equal(evidence.seam.storyBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(evidence.seam.ledgerBackground, 'rgba(0, 0, 0, 0)'); assert.equal(evidence.seam.ledgerBorder, '0px');
  await shot('reading-seam'); await evaluate('scrollTo(0,0)');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(300); assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await click('.pond-global-header__menu-button');
  assert.ok(await evaluate("document.querySelector('#pond-public-navigation a[href=\"/tracks\"]')?.getBoundingClientRect().width>0"));
  await shot('mobile-header'); await click('.pond-global-header__menu-button');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const path of ['/me', '/score/1', '/echo/1']) {
    await send('Page.navigate', { url: origin+path });
    await waitFor("document.querySelector('.pond-global-header nav button')?.textContent==='登录'");
    const current = await evaluate(header); assert.deepEqual(current.links, evidence.tracksHeader.links);
    evidence[path+'Header'] = current;
  }
  }
  // 等待客户端和水面实际就绪，服务端的首段页头不能代替完成导航。
  await send('Page.navigate', { url: origin+'/score/1' });
  await waitFor("document.querySelector('[data-pond-shell]')?.dataset.pondMountId && document.querySelector('[data-pond-shell] canvas') && document.querySelector('.pond-global-header nav button')?.textContent==='登录'");
  await evaluate("window.__water=document.querySelector('[data-pond-shell] canvas');true");
  await route('.pond-global-header nav a[href="/tracks"]', '/tracks', 'tracks');
  await waitFor("document.querySelector('[data-track-circle]')?.dataset.circleRenderer==='webgl'");
  evidence.scoreToTracks = '等待真实挂载后，共享Canvas保留，曲目重新取得WebGL场景';
  assert.deepEqual(browser.pageErrors, []); assert.deepEqual(browser.consoleErrors, []);
  evidence.pageErrors = browser.pageErrors; evidence.consoleErrors = browser.consoleErrors;
  await writeFile(join(output, 'browser-integration-v11.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  failed = true;
  await writeFile(join(output, 'browser-integration-v11.json'), JSON.stringify({ ...evidence, failure: error.stack }, null, 2));
  throw error;
} finally { browser.close(failed); }
