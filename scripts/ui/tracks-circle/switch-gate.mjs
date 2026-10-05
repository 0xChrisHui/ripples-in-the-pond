import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openTracksBrowser, observeWater } from '../tracks-pond/browser.mjs';

const origin = 'http://127.0.0.1:3121';
const output = join(process.cwd(), 'reviews/evidence/tracks-redesign');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cdp = await openTracksBrowser(origin); const { evaluate, send } = cdp;
const evidence = { at: new Date().toISOString(), origin };
const poseExpression = `(() => { const n=document.querySelector('[data-track-circle]');
  const r=n.querySelector('button').getBoundingClientRect();const g=n.querySelector('[data-circle-eclipse]').getScreenCTM();
  return {at:performance.now(),x:r.left+r.width/2,y:r.top+r.height/2,diameter:r.width,containerWidth:n.getBoundingClientRect().width,
    ex:g.e,ey:g.f,time:Number(n.dataset.circleTime),dx:Number(n.dataset.circleDx),dy:Number(n.dataset.circleDy),
    mix:Number(n.dataset.circleMix),color:n.dataset.circleColor,phase:n.dataset.phase,session:n.dataset.circleSession,
    sameCircle:n===window.__switchCircle,sameCanvas:document.querySelector('[data-pond-shell] canvas')===window.__switchCanvas,
    renderer:n.dataset.circleRenderer,track:document.querySelector('.track-archive').dataset.selectedTrack,
    width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth}; })()`;
async function waitFor(expression) {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline) { if(await evaluate(expression)) return; await sleep(100); }
  throw new Error(`未满足条件：${expression}`);
}
function checkPose(p) {
  assert.ok(Math.abs(p.x-p.ex)<.5 && Math.abs(p.y-p.ey)<.5,'圆和日食同位');
  assert.ok(Math.abs(p.dx)<=p.height*.05 && Math.abs(p.dy)<=p.height*.05,'随机漂移保持边界');
  assert.ok(p.scrollWidth<=p.width,'无横向溢出');
}
async function select(number) {
  const value=await evaluate(`(async () => {
    const before=${poseExpression};
    document.querySelector('[data-track-index-item="${number}"]').click();
    await new Promise(resolve=>setTimeout(resolve,0));
    const immediate=${poseExpression};
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    const frame=${poseExpression};
    return {before,immediate,frame}; })()`);
  evidence.pendingSwitch=value;
  for (const p of [value.immediate,value.frame]) {
    assert.equal(p.track,String(number)); assert.equal(p.sameCircle,true); assert.equal(p.sameCanvas,true);
    assert.equal(p.session,value.before.session); assert.ok(p.time>=value.before.time,'换曲不重启时钟');
    assert.equal(p.renderer,'webgl'); checkPose(p);
    const distance=Math.hypot(p.x-value.before.x,p.y-value.before.y);
    assert.ok(distance<2+(p.at-value.before.at)*.15,`不跳回起点：${distance}px`);
    assert.equal(p.containerWidth,value.before.containerWidth,'换曲不改变圆的尺寸基准');
    assert.ok(Math.abs(p.diameter-value.before.diameter)<.08+(p.time-value.before.time)*3,'尺寸仅随连续呼吸变化');
  }
  await sleep(900); value.settled=await evaluate(poseExpression); checkPose(value.settled);
  delete evidence.pendingSwitch;
  return value;
}
async function shot(name) {
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(join(output,`${name}-v9.png`),Buffer.from(shot.data,'base64'));
}
try {
  await send('Page.enable');await send('Runtime.enable');await observeWater(cdp);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const token=Date.now();
  await send('Page.navigate',{url:`${origin}/tracks/pond?switchReview=${token}`},45000);
  await waitFor(`location.href.includes('switchReview=${token}') && document.querySelector('[data-track-circle]')?.dataset.circleRenderer==='webgl'`);
  await evaluate(`document.fonts.ready.then(()=>true)`);
  await evaluate(`(() => { window.__switchCircle=document.querySelector('[data-track-circle]');
    window.__switchCanvas=document.querySelector('[data-pond-shell] canvas'); return true; })()`);
  await sleep(1200); evidence.start=await evaluate(poseExpression);
  evidence.switch35=await select(35); evidence.switch31=await select(31); evidence.switch1=await select(1);
  evidence.colorChanged=evidence.switch35.settled.color!==evidence.switch35.before.color;
  assert.equal(evidence.colorChanged,true,'颜色确实在切换');
  await shot('desktop-circle-continuity');
  let p=await evaluate(poseExpression);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:p.x,y:p.y});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:p.x,y:p.y});
  await waitFor(`document.querySelector('[data-track-circle]').dataset.phase==='playing' && Number(document.querySelector('[data-track-circle]').dataset.circleMix)>.99`);
  evidence.playingSwitch=await select(17);
  assert.ok(evidence.playingSwitch.immediate.mix>.1,'旧日食平滑退出，不瞬间消失');
  await waitFor(`Number(document.querySelector('[data-track-circle]').dataset.circleMix)===0`);
  assert.equal(await evaluate(`document.querySelector('.material-player').dataset.phase`),'idle');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await waitFor(`Number(document.querySelector('[data-track-circle]').dataset.circleDiameter)<200`);
  await sleep(900); await evaluate(`document.querySelector('.track-index__toggle').click()`);
  evidence.mobileSwitch31=await select(31);
  await sleep(900);await shot('mobile-circle-continuity');
  const firstSession=evidence.start.session;
  await send('Page.navigate',{url:`${origin}/tracks/pond?switchReview=${token+1}`},45000);
  await waitFor(`location.href.includes('switchReview=${token+1}') && document.querySelector('[data-track-circle]')?.dataset.circleRenderer==='webgl'`);
  evidence.newSession=await evaluate(poseExpression);
  assert.notEqual(evidence.newSession.session,firstSession,'重新打开使用新的随机会话');
  assert.deepEqual(cdp.pageErrors,[]);assert.deepEqual(cdp.consoleErrors,[]);
  evidence.pageErrors=cdp.pageErrors;evidence.consoleErrors=cdp.consoleErrors;
  await writeFile(join(output,'browser-circle-continuity-v9.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} catch(error) {
  evidence.failure=error.stack;evidence.runtime=await evaluate(poseExpression).catch(()=>null);
  evidence.pageErrors=cdp.pageErrors;evidence.consoleErrors=cdp.consoleErrors;
  await shot('circle-continuity-failure').catch(()=>{});
  await writeFile(join(output,'browser-circle-continuity-v9.failure.json'),JSON.stringify(evidence,null,2));
  throw error;
} finally { cdp.close(); }
