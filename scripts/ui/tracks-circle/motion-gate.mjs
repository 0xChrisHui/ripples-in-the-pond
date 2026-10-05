import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';

const origin = 'http://127.0.0.1:3121';
const output = join(process.cwd(), 'reviews/evidence/tracks-redesign');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cdp = await openTracksBrowser(origin);
const { send, evaluate } = cdp;
const evidence = { measuredAt: new Date().toISOString(), origin };
async function waitFor(expression) {
  const deadline = Date.now()+45000;
  while (Date.now()<deadline) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`页面未就绪：${expression}`);
}
async function pose() {
  const value = await evaluate(`(() => { const n=document.querySelector('[data-track-circle]');
    const r=n.getBoundingClientRect(); const h=n.querySelector('button').getBoundingClientRect();
    const g=n.querySelector('[data-circle-eclipse]').getScreenCTM();
    return {at:performance.now(),time:Number(n.dataset.circleTime),phase:n.dataset.phase,reduced:n.dataset.circleReduced,mix:Number(n.dataset.circleMix),
      dx:Number(n.dataset.circleDx),dy:Number(n.dataset.circleDy),
      x:h.left+h.width/2,y:h.top+h.height/2,eclipseX:g.e,eclipseY:g.f,
      width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth}; })()`);
  assert.ok(Math.abs(value.dx)<=value.height*.05+.1 && Math.abs(value.dy)<=value.height*.05+.1);
  assert.ok(Math.abs(value.x-value.eclipseX)<.5 && Math.abs(value.y-value.eclipseY)<.5);
  assert.ok(value.scrollWidth<=value.width);
  return value;
}
async function measure(name) {
  const before=await pose(); await sleep(2000); const after=await pose();
  const distance=Math.hypot(after.dx-before.dx,after.dy-before.dy);
  evidence[name]={before,after,distance};
  assert.ok(distance>.1, `随机路径仍在移动：${distance}px`);
  assert.ok(after.time-before.time>1.5,'低帧率仍按真实时间推进');
  const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(join(output,`${name}-v8.png`),Buffer.from(result.data,'base64'));
}
async function clickCircle() {
  const p=await pose();
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:p.x,y:p.y});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:p.x,y:p.y});
}
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const token=Date.now();
  await send('Page.navigate',{url:`${origin}/tracks/pond?motionReview=${token}`},45000);
  await waitFor(`location.href.includes('motionReview=${token}') &&
    document.querySelector('[data-track-circle]')?.dataset.circleRenderer==='webgl'`);
  await evaluate('document.fonts.ready.then(()=>true)');
  await measure('desktop-circle-motion'); await clickCircle();
  await waitFor(`document.querySelector('[data-track-circle]').dataset.phase==='playing' &&
    Number(document.querySelector('[data-track-circle]').dataset.circleMix)>.99`);
  await measure('desktop-eclipse-motion'); await clickCircle();
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await waitFor(`(() => { const n=document.querySelector('[data-track-circle]');
    return Number(n.dataset.circleDiameter)<200 && n.dataset.phase==='idle'; })()`);
  await measure('mobile-circle-motion');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await waitFor(`document.querySelector('[data-track-circle]').dataset.circleReduced==='true'`);
  evidence.reduced=await pose(); assert.equal(evidence.reduced.dx,0); assert.equal(evidence.reduced.dy,0);
  await send('Emulation.setEmulatedMedia',{features:[]});
  assert.deepEqual(cdp.pageErrors,[]); assert.deepEqual(cdp.consoleErrors,[]);
  evidence.pageErrors=cdp.pageErrors; evidence.consoleErrors=cdp.consoleErrors;
  await writeFile(join(output,'browser-circle-motion-v8.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} catch(error) {
  evidence.failure=error.stack;
  await writeFile(join(output,'browser-circle-motion-v8.failure.json'),JSON.stringify(evidence,null,2));
  throw error;
} finally { cdp.close(); }
