import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const CDP = process.env.P14_CDP ?? 'http://localhost:9336', APP = process.env.P14_APP ?? 'http://localhost:3014/';
const OUT = path.resolve('reviews/evidence/p14-g6-track36');
const REGULAR = 'button[aria-pressed]:not([data-featured-echo-hit])';
const ECHO = '[data-featured-echo-hit]';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(url) {
    this.id = 0; this.pending = new Map(); this.requests = new Map();
    this.consoleIssues = []; this.consoleWarnings = []; this.networkIssues = []; this.ws = new WebSocket(url);
  }
  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP 连接超时')), 8_000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
      this.ws.addEventListener('message', (event) => this.onMessage(JSON.parse(event.data)));
    });
  }
  onMessage(message) {
    if (!message.id) {
      const p = message.params;
      if (message.method === 'Runtime.exceptionThrown') this.consoleIssues.push(p.exceptionDetails?.text ?? 'exception');
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) {
        const text = `${p.type}: ${p.args.map((a) => a.value ?? a.description).join(' ')}`;
        (p.type === 'error' ? this.consoleIssues : this.consoleWarnings).push(text);
      }
      if (message.method === 'Network.requestWillBeSent') this.requests.set(p.requestId, p.request.url);
      if (message.method === 'Network.responseReceived' && p.response.status >= 400
        && ['Fetch', 'XHR', 'Media'].includes(p.type)) this.networkIssues.push({ url: p.response.url, status: p.response.status });
      if (message.method === 'Network.loadingFailed') this.networkIssues.push({
        url: this.requests.get(p.requestId) ?? p.requestId, error: p.errorText,
      });
      return;
    }
    const job = this.pending.get(message.id); if (!job) return;
    this.pending.delete(message.id);
    message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} 超时`)); }, 15_000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function evaluate(cdp, expression) {
  const out = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.text);
  return out.result.value;
}
async function waitFor(cdp, expression, label, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(cdp, expression)) return; await sleep(120); }
  throw new Error(`等待失败：${label}`);
}
async function screenshot(cdp, name) {
  const out = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const data = Buffer.from(out.data, 'base64'); await writeFile(path.join(OUT, name), data); return data;
}
async function clickAt(cdp, p) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
}
async function darkRatio(buffer, excluded) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let dark = 0, total = 0;
  for (let y = 210; y < info.height - 170; y += 54) for (let x = 270; x < info.width - 60; x += 54) {
    if (Math.hypot(x - excluded.x, y - excluded.y) < 230) continue;
    const i = (y * info.width + x) * 3; if (Math.max(data[i], data[i + 1], data[i + 2]) <= 6) dark++; total++;
  }
  return total ? dark / total : 0;
}
async function apiJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  assert.equal(response.status, 200, `${url} HTTP ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function regularPoint(cdp) {
  return evaluate(cdp, `(() => { const e=[...document.querySelectorAll('${REGULAR}')].filter((b)=>{const s=getComputedStyle(b);return+s.opacity>.05&&s.pointerEvents==='auto'}).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return Math.hypot(ar.left+ar.width/2-innerWidth/2,ar.top+ar.height/2-innerHeight/2)-Math.hypot(br.left+br.width/2-innerWidth/2,br.top+br.height/2-innerHeight/2)})[0];e.focus();const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
}
async function pressEnter(cdp) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
}
async function stopRegular(cdp) {
  await evaluate(cdp, `document.querySelector('${REGULAR}[aria-pressed="true"]').focus()`); await pressEnter(cdp);
  await waitFor(cdp, `document.querySelector('[data-pond-root]')?.dataset.pondEclipseActive==='false'`, '普通音乐停止');
  await waitFor(cdp, `Number(getComputedStyle(document.body).getPropertyValue('--pond-scene-presence'))>.8`, '水塘恢复');
}

const echoDto = (await apiJson(`${APP}api/echo/featured`)).echo;
assert.equal(echoDto?.kind, 'pond-echo');
assert.equal(echoDto?.tokenId, '1');
assert.equal(echoDto?.href, '/echo/1');
assert.equal(
  echoDto?.identity,
  `eip155:${echoDto?.chainId}:${echoDto?.contractAddress}:1`,
  'ECHO identity 必须绑定 chainId + contract + tokenId',
);
assert.equal(echoDto?.playbackId, `pond-echo:${echoDto?.identity}`);
assert.match(echoDto.recipe, /^[A-Z0-9]{36}$/); assert.ok(echoDto.durationMs > 0);
assert.ok([...new Set(echoDto.recipe)].every((key) => echoDto.clips[key]?.uri?.startsWith('ar://')));

const targets = await (await fetch(`${CDP}/json/list`)).json();
const target = targets.find((item) => item.type === 'page' && item.url.startsWith(APP));
assert.ok(target?.webSocketDebuggerUrl, `未找到 ${APP} 的 Edge page target`);
await mkdir(OUT, { recursive: true }); const cdp = new Cdp(target.webSocketDebuggerUrl);

try {
  await cdp.open(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  await cdp.send('Page.bringToFront'); await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await cdp.send('Page.reload', { ignoreCache: true }); await sleep(250);
  await waitFor(cdp, `document.readyState==='complete'`, '首页加载');
  await waitFor(cdp, `document.querySelectorAll('${REGULAR}').length===35&&document.querySelectorAll('${ECHO}').length===1`, '35+1 DOM', 30_000);
  await waitFor(cdp, `(()=>{const e=document.querySelector('${ECHO}'),r=e.getBoundingClientRect();return getComputedStyle(e).pointerEvents==='auto'&&r.right>0&&r.left<innerWidth})()`, 'ECHO #1 入场', 45_000);
  const desktop = await evaluate(cdp, `(()=>{const e=document.querySelector('${ECHO}'),r=e.getBoundingClientRect(),c=document.querySelector('canvas');window.__smokeCanvas=c;window.__smokeGl=c.getContext('webgl2')||c.getContext('webgl');return{regular:document.querySelectorAll('${REGULAR}').length,featured:document.querySelectorAll('${ECHO}').length,hitW:r.width,hitH:r.height,canvas:document.querySelectorAll('canvas').length,webgl:!!window.__smokeGl}})()`);
  assert.deepEqual([desktop.regular, desktop.featured], [35, 1]); assert.ok(desktop.hitW >= 44 && desktop.hitH >= 44); assert.ok(desktop.webgl);
  await screenshot(cdp, 'smoke-desktop-ready.png');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 980 });

  let regularDark = 0;
  for (let cycle = 0; cycle < 20; cycle++) {
    const p = await regularPoint(cdp); await pressEnter(cdp);
    await waitFor(cdp, `document.querySelector('[data-pond-root]')?.dataset.pondEclipseActive==='true'`, `普通播放 ${cycle + 1}`);
    if (cycle === 0) {
      await waitFor(cdp, `Number(getComputedStyle(document.body).getPropertyValue('--pond-scene-presence'))<=.01`, '普通日食纯黑');
      assert.ok(await evaluate(cdp, `[...document.querySelectorAll('nav button')].filter((b)=>b.disabled).length>=3`));
      const shot = await screenshot(cdp, 'smoke-desktop-eclipse.png'); regularDark = await darkRatio(shot, p); assert.ok(regularDark >= .92);
      await evaluate(cdp, `document.activeElement?.blur()`);
      const keys = [...'abcdefghijklmnopqrstuvwxyz345678', ' ']; assert.equal(keys.length, 33);
      for (const key of keys) { const code = key === ' ' ? 'Space' : /^\d$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code }); await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }); }
      await sleep(300); await screenshot(cdp, 'smoke-desktop-p9-33keys.png');
    }
    await stopRegular(cdp);
  }
  await waitFor(cdp, `Number(getComputedStyle(document.body).getPropertyValue('--pond-scene-presence'))>=.99`, '20 次后完全恢复');
  const stable = await evaluate(cdp, `(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');return{canvas:document.querySelectorAll('canvas').length,sameCanvas:c===window.__smokeCanvas,sameContext:g===window.__smokeGl}})()`);
  assert.deepEqual(stable, { canvas: desktop.canvas, sameCanvas: true, sameContext: true });
  await screenshot(cdp, 'smoke-desktop-restored.png');

  // 重载后从首次 2–4 秒入场验证 ECHO，避免把随机复现和屏外路径误判为失败。
  await cdp.send('Page.reload', { ignoreCache: true });
  await waitFor(cdp, `document.readyState==='complete'`, 'ECHO 验收重载');
  await waitFor(cdp, `document.querySelectorAll('${REGULAR}').length===35&&document.querySelectorAll('${ECHO}').length===1`, '重载后 35+1 DOM', 60_000);
  await waitFor(cdp, `(()=>{const e=document.querySelector('${ECHO}'),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);return getComputedStyle(e).pointerEvents==='auto'&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight&&(top===e||!!top?.closest('${ECHO}'))})()`, 'ECHO 可点击首次入场', 45_000);
  await evaluate(cdp, `(()=>{const c=document.querySelector('canvas');window.__echoCanvas=c;window.__echoGl=c.getContext('webgl2')||c.getContext('webgl');return true})()`);
  let echoPoint = await evaluate(cdp, `(()=>{const e=document.querySelector('${ECHO}'),r=e.getBoundingClientRect();window.__echoClicked=false;e.addEventListener('click',()=>{window.__echoClicked=true},{once:true});return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await evaluate(cdp, `(()=>{window.__echoOutcome=null;let seen=false;window.__echoWatch=setInterval(()=>{const s=document.querySelector('[data-featured-echo-player]')?.dataset.featuredEchoPlayer;if(s)seen=true;if(s==='playing'||s==='error'||(seen&&!s)){window.__echoOutcome=s??'error';clearInterval(window.__echoWatch)}},50);return true})()`);
  for (let attempt = 0; attempt < 5 && !await evaluate(cdp, `window.__echoClicked`); attempt++) { echoPoint = await evaluate(cdp, `(()=>{const r=document.querySelector('${ECHO}').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`); await clickAt(cdp, echoPoint); await sleep(250); }
  assert.equal(await evaluate(cdp, `window.__echoClicked`), true, '真实指针未触发 ECHO 点击');
  await waitFor(cdp, `window.__echoOutcome`, 'ECHO playing/error', 240_000);
  const echoState = await evaluate(cdp, `(()=>{const p=document.querySelector('[data-featured-echo-player]');return{state:p?.dataset.featuredEchoPlayer??'error',position:+(p?.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')??0),favorite:[...p?.querySelectorAll('button')??[]].some((b)=>b.textContent.includes('收藏'))}})()`);
  assert.equal(echoState.state, 'playing', `ECHO 永久片段未进入 playing；网络=${JSON.stringify(cdp.networkIssues.slice(-12))}`); assert.equal(echoState.favorite, false);
  await waitFor(cdp, `+document.querySelector('[data-featured-echo-player] [role=progressbar]').getAttribute('aria-valuenow')>${echoState.position + 250}`, 'ECHO 进度前进');
  await waitFor(cdp, `Number(getComputedStyle(document.body).getPropertyValue('--pond-scene-presence'))<=.01`, 'ECHO 日食纯黑');
  const echoShot = await screenshot(cdp, 'smoke-desktop-echo-playing.png'); const echoDark = await darkRatio(echoShot, echoPoint); assert.ok(echoDark >= .92);
  await evaluate(cdp, `[...document.querySelectorAll('[data-featured-echo-player] button')].find((b)=>b.textContent==='暂停').click()`); await waitFor(cdp, `document.querySelector('[data-featured-echo-player]')?.dataset.featuredEchoPlayer==='paused'`, 'ECHO 暂停');
  const pausedAt = await evaluate(cdp, `+document.querySelector('[data-featured-echo-player] [role=progressbar]').getAttribute('aria-valuenow')`);
  await sleep(500); assert.ok(Math.abs((await evaluate(cdp, `+document.querySelector('[data-featured-echo-player] [role=progressbar]').getAttribute('aria-valuenow')`)) - pausedAt) < 60);
  await evaluate(cdp, `[...document.querySelectorAll('[data-featured-echo-player] button')].find((b)=>b.textContent==='继续').click()`); await waitFor(cdp, `document.querySelector('[data-featured-echo-player]')?.dataset.featuredEchoPlayer==='playing'`, 'ECHO 继续');
  await evaluate(cdp, `[...document.querySelectorAll('[data-featured-echo-player] button')].find((b)=>b.textContent==='停止').click()`); await waitFor(cdp, `!document.querySelector('[data-featured-echo-player]')`, 'ECHO 停止');
  await waitFor(cdp, `Number(getComputedStyle(document.body).getPropertyValue('--pond-scene-presence'))>=.99`, 'ECHO 后恢复');

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 844, deviceScaleFactor: 1, mobile: true }); await sleep(900);
  const mobile = await evaluate(cdp, `(()=>{const r=document.querySelector('${ECHO}').getBoundingClientRect(),c=document.querySelector('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');return{width:innerWidth,height:innerHeight,hitW:r.width,hitH:r.height,overflow:document.documentElement.scrollWidth>innerWidth,canvas:document.querySelectorAll('canvas').length,sameWebgl:c===window.__echoCanvas&&g===window.__echoGl}})()`);
  assert.deepEqual([mobile.width, mobile.height], [375, 844]); assert.ok(mobile.hitW >= 44 && mobile.hitH >= 44);
  assert.equal(mobile.overflow, false); assert.equal(mobile.canvas, desktop.canvas); assert.equal(mobile.sameWebgl, true);
  await screenshot(cdp, 'smoke-mobile-375x844.png');
  await cdp.send('Page.navigate', { url: `${APP}?forceFallback=1` }); await waitFor(cdp, `document.querySelector('${ECHO}')?.dataset.echoRenderMode==='css-fallback'`, 'CSS ECHO fallback', 60_000);
  const fallback = await evaluate(cdp, `(()=>{const e=document.querySelector('${ECHO}'),r=e.getBoundingClientRect();return{w:r.width,h:r.height,pointer:getComputedStyle(e).pointerEvents,mode:e.dataset.echoRenderMode}})()`);
  assert.ok(fallback.w >= 44 && fallback.h >= 44); assert.equal(fallback.pointer, 'auto'); assert.equal(fallback.mode, 'css-fallback');
  await evaluate(cdp, `document.querySelector('${ECHO}').click()`);
  await waitFor(cdp, `['loading','playing','error'].includes(document.querySelector('[data-featured-echo-player]')?.dataset.featuredEchoPlayer)`, 'fallback ECHO 控制反馈');
  assert.ok(await evaluate(cdp, `Number(getComputedStyle(document.body).getPropertyValue('--pond-scene-presence'))>.9`), 'fallback 播放不得进入无焦点黑场');
  console.log(JSON.stringify({ functionalGates: 'passed', api: { echo: echoDto.playbackId, recipe: echoDto.recipe.length }, desktop,
    regular: { cycles: 20, darkRatio: regularDark, p9Keys: 33 }, stable, echo: { ...echoState, darkRatio: echoDark }, mobile,
    consoleErrors: cdp.consoleIssues, consoleWarnings: cdp.consoleWarnings }, null, 2));
  assert.deepEqual(cdp.consoleIssues, []);
} catch (error) {
  try { await screenshot(cdp, 'smoke-failure.png'); } catch { /* 保留原始失败 */ }
  const diagnostic = await evaluate(cdp, `({url:location.href,regular:document.querySelectorAll('${REGULAR}').length,featured:document.querySelectorAll('${ECHO}').length,player:document.querySelector('[data-featured-echo-player]')?.dataset.featuredEchoPlayer??null,text:document.body.innerText.slice(-400)})`);
  console.error(JSON.stringify({ diagnostic, consoleErrors: cdp.consoleIssues,
    consoleWarnings: cdp.consoleWarnings, network: cdp.networkIssues.slice(-20) }, null, 2)); throw error;
} finally { cdp.close(); }
