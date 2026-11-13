import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openTracksBrowser } from '../tracks-pond/browser.mjs';
const origin = 'http://127.0.0.1:3123', out = 'reviews/evidence/p23-score/pinch';
await mkdir(out, { recursive: true });
const b = await openTracksBrowser(origin), { send, evaluate } = b;
const sleep = ms => new Promise(r => setTimeout(r, ms)), results = [];
const press = points => send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
const move = points => send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points });
const release = () => send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const sample = () => evaluate(`(()=>{const es=[...document.querySelectorAll('.pond-home-surface button[data-render-node-id]')].filter(e=>e.style.pointerEvents!=='none');return {scale:visualViewport.scale,average:es.reduce((a,e)=>a+e.getBoundingClientRect().width,0)/es.length,playing:es.filter(e=>e.getAttribute('aria-pressed')==='true').length,balls:es.map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.renderNodeId,x:r.x+r.width/2,y:r.y+r.height/2,r:r.width/2}})}})()`);
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: `${origin}/` }, 120_000);
  const end = Date.now() + 60_000;
  while (Date.now() < end && !(await evaluate(`document.querySelectorAll('.pond-home-surface button[data-render-node-id]').length>=35`))) await sleep(200);
  await sleep(1000);
  const before = await sample();
  await press([{ x: 155, y: 720, id: 1 }, { x: 235, y: 720, id: 2 }]);
  for (let i = 1; i <= 12; i++) { await move([{ x: 155 - i * 10, y: 720, id: 1 }, { x: 235 + i * 10, y: 720, id: 2 }]); await sleep(40); }
  await release(); await sleep(1600);
  const opened = await sample();
  assert.equal(opened.scale, before.scale, '双指张开不能放大网页');
  assert.ok(opened.average > before.average * 1.08, `球应整体放大 ${before.average}→${opened.average}`);
  results.push('两指张开使球整体变大，网页缩放不变');
  await press([{ x: 35, y: 720, id: 1 }, { x: 355, y: 720, id: 2 }]);
  for (let i = 1; i <= 12; i++) { await move([{ x: 35 + i * 10, y: 720, id: 1 }, { x: 355 - i * 10, y: 720, id: 2 }]); await sleep(40); }
  await release(); await sleep(1600);
  const closed = await sample();
  assert.ok(closed.average < opened.average * .95, '两指捏合应整体缩小');
  assert.equal(closed.playing, 0); results.push('两指捏合使球整体变小且不触发播放');
  const ball = closed.balls.find(x => x.x > 30 && x.x < 360 && x.y > 150 && x.y < 650);
  assert.ok(ball);
  await press([{ x: ball.x, y: ball.y, id: 1 }]);
  await press([{ x: ball.x, y: ball.y, id: 1 }, { x: 25, y: 720, id: 2 }]);
  await move([{ x: ball.x + 8, y: ball.y + 8, id: 1 }, { x: 30, y: 720, id: 2 }]);
  await release(); await sleep(500);
  assert.equal((await sample()).playing, 0); results.push('第一指在球上再加第二指不会点播');
  const other = closed.balls.find(x => x.id !== ball.id && Math.hypot(x.x - ball.x, x.y - ball.y) > 80 && x.y > 150 && x.y < 650);
  assert.ok(other);
  await press([{ x: ball.x, y: ball.y, id: 1 }, { x: other.x, y: other.y, id: 2 }]);
  await release(); await sleep(500);
  assert.equal((await sample()).playing, 0); results.push('双指分别落在两个球上不会点播');
  const fresh = (await sample()).balls.find(x => x.id === ball.id);
  await press([{ x: fresh.x, y: fresh.y, id: 1 }]);
  await move([{ x: fresh.x + 35, y: fresh.y + 25, id: 1 }]); await sleep(150);
  const dragged = (await sample()).balls.find(x => x.id === ball.id);
  assert.ok(Math.hypot(dragged.x - fresh.x, dragged.y - fresh.y) > 12, '双指结束后单指仍应能拖球');
  await release(); await sleep(200);
  assert.equal((await sample()).playing, 0); results.push('双指结束后单指拖动恢复且不误点播');
  await writeFile(`${out}/result.json`, JSON.stringify({ passed: true, before, opened, closed, results }, null, 2));
  console.log(`${results.length} 项触摸浏览器门禁通过`);
} catch (error) {
  await writeFile(`${out}/result.json`, JSON.stringify({ passed: false, results, error: String(error) }, null, 2));
  console.error(error); process.exitCode = 1;
} finally { b.close(); }
