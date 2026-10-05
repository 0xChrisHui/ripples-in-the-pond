import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openTracksBrowser, observeWater } from '../tracks-pond/browser.mjs';

const origin = process.env.TRACKS_TEST_ORIGIN ?? 'http://127.0.0.1:3121';
const output = join(process.cwd(), 'reviews/evidence/tracks-redesign');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cdp = await openTracksBrowser(origin);
const { send, evaluate } = cdp;
const reviewPass = process.env.TRACKS_CIRCLE_REVIEW_PASS;
const resume = Boolean(reviewPass);
const evidence = resume ? JSON.parse(await readFile(join(output,reviewPass==='mobile' ? 'browser-circle-v7.failure.json' : 'browser-circle-v7.json'),'utf8'))
  : { measuredAt: new Date().toISOString(), origin };
if (resume) { delete evidence.failure; delete evidence.runtime; evidence.resumedAt=new Date().toISOString(); }
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
async function click(selector) {
  const point = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();
    return r && {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  assert.ok(point, `控件存在：${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function shot(name) {
  const value = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(output, `${name}.png`), Buffer.from(value.data, 'base64'));
}
async function settle(owner) {
  await waitFor(`document.querySelector('[data-pond-shell]')?.dataset.pondCurrent === '${owner}' &&
    document.querySelector('[data-pond-shell]')?.dataset.pondStage === 'stable'`);
}
async function circleReady(renderer = 'webgl') {
  await settle('tracks');
  await waitFor(`document.querySelector('[data-track-circle]')?.dataset.circleRenderer === '${renderer}' &&
    Number(document.querySelector('[data-track-circle]').dataset.circleDiameter)>0`);
  await evaluate('document.fonts.ready.then(() => true)');
  await waitFor(`(() => { const n=document.querySelector('[data-track-circle]'); const r=n.getBoundingClientRect();
    const d=Number(n.dataset.circleDiameter); return r.width>0 && Math.abs(r.width-r.height)<.5 &&
    Math.abs(d-r.width*.56)<r.width*.008; })()`);
}
async function pose() {
  const value = await evaluate(`(() => {
    const root=document.querySelector('[data-track-circle]'); const r=root.getBoundingClientRect();
    const hit=root.querySelector('button').getBoundingClientRect();
    const g=root.querySelector('[data-circle-eclipse]').getScreenCTM();
    const play=document.querySelector('.material-player__action').getBoundingClientRect();
    return { ...root.dataset, x:hit.left+hit.width/2,y:hit.top+hit.height/2,diameter:hit.width,
      anchorX:Number(root.dataset.circleAnchorX),anchorY:Number(root.dataset.circleAnchorY),anchorWidth:r.width,anchorHeight:r.height,
      aspectRatio:getComputedStyle(root).aspectRatio,eclipseX:g.e,eclipseY:g.f,eclipseDiameter:100*g.a,
      playTop:play.top,playBottom:play.bottom,height:innerHeight,width:innerWidth,
      scrollWidth:document.documentElement.scrollWidth,bodyMix:getComputedStyle(document.body).getPropertyValue('--pond-eclipse-mix'),
      seek:document.querySelector('.material-seek [role="slider"]')?.getAttribute('aria-valuenow') }; })()`);
  evidence.latestPose=value;
  assert.ok(Math.abs(value.x-value.anchorX) <= value.height*.05+.1);
  assert.ok(Math.abs(value.y-value.anchorY) <= value.height*.05+.1);
  assert.ok(Math.abs(value.x-value.eclipseX)<.5 && Math.abs(value.y-value.eclipseY)<.5, '日食与点击区域共用圆心');
  assert.ok(Math.abs(value.diameter-value.eclipseDiameter)<.5, '日食与基础圆共用尺寸');
  assert.ok(value.scrollWidth<=value.width, '无横向溢出');
  return value;
}
async function continuity() {
  const value = await evaluate(`(() => { const shell=document.querySelector('[data-pond-shell]'); const c=shell.querySelector('canvas');
    return {sameCanvas:c===window.__circleCanvas,sameContext:c.__tracksContext===window.__circleContext,
      sameMount:shell.dataset.pondMountId===window.__circleMount,draws:c.__tracksDraws-window.__circleDraws,
      glCanvases:[...document.querySelectorAll('canvas')].filter(c=>c.__tracksContext).length,
      contextLost:c.__tracksContext.isContextLost()}; })()`);
  assert.ok(value.sameCanvas && value.sameContext && value.sameMount && value.draws>0);
  assert.equal(value.glCanvases,1); assert.equal(value.contextLost,false);
  return value;
}
try {
  await mkdir(output, { recursive: true });
  await send('Page.enable'); await send('Runtime.enable'); await observeWater(cdp);
  await send('Emulation.setDeviceMetricsOverride', { width:1440,height:900,deviceScaleFactor:1,mobile:false });
  if (!resume) {
  await send('Page.navigate', {url:`${origin}/?tracks=pond`}); await settle('home');
  await waitFor(`document.querySelector('[data-pond-shell] canvas')?.__tracksContext &&
    document.querySelector('[data-pond-shell]')?.dataset.pondSceneReady==='true'`);
  await evaluate(`(() => { const shell=document.querySelector('[data-pond-shell]'); const c=shell.querySelector('canvas');
    window.__circleCanvas=c;window.__circleContext=c.__tracksContext;window.__circleMount=shell.dataset.pondMountId;
    window.__circleDraws=c.__tracksDraws; })()`);
  await click('a[href="/tracks/pond"]'); await circleReady();
  evidence.enter=await continuity(); evidence.desktop=await pose();
  assert.ok(evidence.desktop.playBottom<=900 && evidence.desktop.playTop>=0,'首屏可播放');
  await shot('desktop-circle-v7'); await sleep(850); evidence.motion=await pose();
  assert.ok(Math.abs(evidence.motion.x-evidence.desktop.x)+Math.abs(evidence.motion.y-evidence.desktop.y)>.05,'圆圈持续微移');
  await click('.track-circle__hit');
  await waitFor(`document.querySelector('.material-player')?.dataset.phase==='playing' &&
    Number(document.querySelector('[data-track-circle]').dataset.circleMix)>.99`);
  await sleep(350); evidence.playing=await pose();
  assert.ok(Number(evidence.playing.seek)>0,'原生音频进度前进'); assert.ok(Number(evidence.playing.bodyMix)>.99);
  await shot('desktop-eclipse-v7');
  await evaluate(`document.querySelector('#track-story').scrollIntoView()`);
  await waitFor(`document.querySelector('[data-track-circle]')?.dataset.circleVisible==='false'`);
  assert.equal(await evaluate(`document.querySelector('.material-player').dataset.phase`),'playing');
  evidence.offscreenPlayback=true;
  await evaluate('window.scrollTo(0,0)'); await sleep(150);
  await click('.track-circle__hit');
  await waitFor(`document.querySelector('.material-player').dataset.phase==='idle' &&
    Number(document.querySelector('[data-track-circle]').dataset.circleMix)===0`);
  evidence.stopped=await pose();
  await click('.track-circle__hit');
  await waitFor(`document.querySelector('.material-player').dataset.phase==='playing'`);
  await click('[data-track-index-item="35"]'); await circleReady();
  await waitFor(`document.querySelector('.material-player').dataset.phase==='idle' &&
    Number(document.querySelector('[data-track-circle]').dataset.circleMix)===0`);
  evidence.switchTrack=await pose();
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA'});
  assert.equal(await evaluate(`document.querySelector('.material-player').dataset.phase`),'idle');
  await click('.track-header__back'); await settle('home'); evidence.returnHome=await continuity();
  await click('a[href="/tracks/pond"]'); await circleReady();
  await click('a[href="/tracks?track=1"]');
  await waitFor(`location.pathname==='/tracks' && !!document.querySelector('.sound-imprint__contours')`);
  evidence.archivePreserved=true;
  await click('a[href="/tracks/pond?track=1"]'); await circleReady();
  } else {
    const reviewToken=Date.now();
    await send('Page.navigate',{url:`${origin}/tracks/pond?track=1&reviewCircle=${reviewToken}`},45000);
    await waitFor(`location.href.includes('reviewCircle=${reviewToken}')`); await circleReady();
    if (reviewPass==='finish') {
      evidence.finalDesktop=await pose(); await shot('desktop-circle-v7');
      await click('.track-circle__hit');
      await waitFor(`document.querySelector('.material-player').dataset.phase==='playing' &&
        Number(document.querySelector('[data-track-circle]').dataset.circleMix)>.99`);
      evidence.finalDesktopPlaying=await pose(); await shot('desktop-eclipse-v7'); await click('.track-circle__hit');
    }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await circleReady(); evidence.mobile=await pose();
  assert.ok(evidence.mobile.playTop>=0 && evidence.mobile.playBottom<=844); await shot('mobile-circle-v7');
  await click('.track-circle__hit');
  await waitFor(`document.querySelector('.material-player').dataset.phase==='playing' &&
    Number(document.querySelector('[data-track-circle]').dataset.circleMix)>.99`);
  evidence.mobilePlaying=await pose(); await shot('mobile-eclipse-v7'); await click('.track-circle__hit');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await waitFor(`document.querySelector('[data-track-circle]').dataset.circleReduced==='true'`);
  evidence.reduced=await pose(); assert.equal(Number(evidence.reduced.circleDx),0); assert.equal(Number(evidence.reduced.circleDy),0);
  await sleep(300); assert.equal((await pose()).diameter,evidence.reduced.diameter);
  await send('Emulation.setEmulatedMedia',{features:[]});
  await send('Page.navigate',{url:`${origin}/tracks/pond?forceFallback=1`}); await circleReady('fallback');
  evidence.fallback=await pose();
  assert.equal(await evaluate(`document.querySelector('.track-circle__fallback').dataset.visible`),'true');
  await click('.track-circle__hit');
  await waitFor(`document.querySelector('.material-player').dataset.phase==='playing' &&
    Number(document.querySelector('[data-track-circle]').dataset.circleMix)>.99`);
  evidence.fallbackPlaying=await pose(); await click('.track-circle__hit');
  assert.deepEqual(cdp.pageErrors,[]); assert.deepEqual(cdp.consoleErrors,[]);
  evidence.pageErrors=cdp.pageErrors; evidence.consoleErrors=cdp.consoleErrors;
  await writeFile(join(output,'browser-circle-v7.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} catch(error) {
  evidence.failure=error.stack; evidence.pageErrors=cdp.pageErrors; evidence.consoleErrors=cdp.consoleErrors;
  evidence.runtime=await evaluate(`({path:location.pathname,shell:{...document.querySelector('[data-pond-shell]')?.dataset},
    circle:{...document.querySelector('[data-track-circle]')?.dataset}})`).catch(()=>null);
  await shot('circle-v7-failure').catch(()=>{});
  await writeFile(join(output,'browser-circle-v7.failure.json'),JSON.stringify(evidence,null,2));
  throw error;
} finally { cdp.close(); }
