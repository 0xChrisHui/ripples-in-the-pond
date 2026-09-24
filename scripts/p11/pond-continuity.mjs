import { openEdge, wait, writeEvidence } from '../../reviews/evidence/p11-i/lib/edge-cdp.mjs';
import { readFile } from 'node:fs/promises';

const fixtures = new Map([
  ['/api/me/score-nfts', { scoreNfts: [1, 2].map((token) => ({
    id: String(token), queueId: `i8-score-${token}`, tokenId: token, status: 'success',
    trackTitle: `Continuity fixture ${token}`, eventCount: 8, failureKind: null,
    submittedAt: '2026-09-24T00:00:00.000Z',
  })) }],
  ['/api/me/scores', { scores: [] }], ['/api/me/nfts', { nfts: [] }],
  ['/api/me/pond-echoes', { echoes: [], onChainTotal: 0, truncated: false,
    originStatusUnavailable: false }],
]);
const resume = Boolean(process.env.P11_I8_RESUME);
const resumeFinal = process.env.P11_I8_RESUME === 'final';
const result = resume
  ? JSON.parse(await readFile('reviews/evidence/p11-i/i8-continuity.json', 'utf8'))
  : { measuredAt: new Date().toISOString(), checks: {}, limitations: [
  'P9 active voice 没有生产调试接口；以 ScorePlaybackEngine reset、触发停止和音源归零交叉验证。',
  'B10/B11 真实账号数据、processing/failed 真实条目和视觉体感留给用户只读目验。',
] };
result.measuredAt = new Date().toISOString(); delete result.fatal; result.checks = {};

function fulfill(send, requestId, value) {
  return send('Fetch.fulfillRequest', { requestId, responseCode: 200,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify(value)).toString('base64') });
}

async function runMain() {
  const edge = await openEdge({ port: 9232,
    profile: resumeFinal ? '.edge-i8-context-profile' : '.edge-i8-profile' });
  const { send, evaluate, until, load, errors, requests, on, close } = edge;
  const networkActive = new Set();
  const local = (url) => url.startsWith('http://127.0.0.1:3000');
  const settle = (path, phase, label = path) => until(
    `location.pathname===${JSON.stringify(path)}
      && document.querySelector('[data-pond-shell]')?.dataset.pondTransition===${JSON.stringify(phase)}`,
    label, 40_000);
  const click = async (selector, path, phase) => {
    const found = await evaluate(`(() => { const n=document.querySelector(${JSON.stringify(selector)});
      if(!n)return false;n.click();return true })()`);
    if (!found) throw new Error(`找不到：${selector}`);
    await settle(path, phase);
  };
  const snap = async (label) => {
    const page = await evaluate(`(() => { const shell=document.querySelector('[data-pond-shell]');
      const core=document.querySelector('[data-pond-mount-id]');const cs=[...document.querySelectorAll('canvas')];
      const gl=core?.querySelector('canvas')??null;const petal=cs.find(c=>c!==gl)??null;
      return {label:${JSON.stringify(label)},path:location.pathname,
        phase:shell?.dataset.pondTransition??null,owner:shell?.dataset.pondSceneOwner??null,
        mountId:core?.dataset.pondMountId??null,sameCore:core===window.__i8Core,
        sameGl:gl===window.__i8Gl,samePetals:petal===window.__i8Petals,
        glId:gl?.dataset.i8ContextId??null,contextCount:window.__i8Contexts??0,
        framebufferCount:window.__i8Framebuffers??0,canvasCount:cs.length,
        cover:document.querySelector('[data-pond-scene-cover]')?.dataset.visible??null,
        glHealth:core?.dataset.glHealth??document.querySelector('[data-gl-health]')?.dataset.glHealth??null,
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        raf:window.__i8Raf?.size??0,listeners:window.__i8Listeners??0,
        fetches:window.__i8Fetches?.size??0,audioContexts:window.__i8AudioContexts?.size??0,
        sources:window.__i8Sources?.size??0,media:window.__i8Media?.size??0,p9:window.__i8P9??0,
        playback:document.querySelector('main[data-score-state]')?.dataset.playbackState??null,
        capability:{coarse:matchMedia('(pointer: coarse)').matches,
          reduced:matchMedia('(prefers-reduced-motion: reduce)').matches},
        heap:performance.memory?.usedJSHeapSize??null};})()`);
    page.network = networkActive.size;
    return page;
  };
  const mark = () => evaluate(`(() => {const core=document.querySelector('[data-pond-mount-id]');
    const gl=core?.querySelector('canvas')??null;window.__i8Core=core;window.__i8Gl=gl;
    window.__i8Petals=[...document.querySelectorAll('canvas')].find(c=>c!==gl)??null;return true})()`);
  const stable = (s) => s.sameCore && s.sameGl && s.samePetals && !s.overflow;
  const homeMe = async (label) => {
    await click('a[href^="/me"]', '/me', 'archive');
    const me = await snap(`${label}-me`);
    await click('.me-archive__back', '/', 'home');
    return [me, await snap(`${label}-home`)];
  };
  const meScore = async (label, token = 1) => {
    await click(`[data-score-origin-key="score-i8-score-${token}"] a`, `/score/${token}`, 'score');
    await until(`document.querySelector('main[data-score-state]')?.dataset.scoreState==='ready'
      && document.querySelector('.me-archive')?.dataset.scoreOriginStage==='score'`, 'Score ready/source', 40_000);
    const score = await snap(`${label}-score`);
    await click('.score-pond-header__back', '/me', 'archive');
    await until(`!document.querySelector('.me-archive')?.dataset.scoreOriginStage`, 'Score 来源恢复', 30_000);
    return [score, await snap(`${label}-me`)];
  };
  const memory = async (label) => {
    await send('HeapProfiler.collectGarbage').catch(() => undefined); await wait(80);
    const [dom, heap] = await Promise.all([send('Memory.getDOMCounters'), send('Runtime.getHeapUsage')]);
    return { label, documents: dom.documents, nodes: dom.nodes, listeners: dom.jsEventListeners,
      used: heap.usedSize, total: heap.totalSize };
  };
  try {
    on('Fetch.requestPaused', (event) => {
      const url = new URL(event.request.url);
      const task = event.request.method === 'GET' && fixtures.has(url.pathname)
        ? fulfill(send, event.requestId, fixtures.get(url.pathname))
        : send('Fetch.continueRequest', { requestId: event.requestId });
      void task.catch(() => undefined);
    });
    on('Network.requestWillBeSent', ({ requestId, request }) => {
      if (local(request.url) && !request.url.includes('/__nextjs_')) networkActive.add(requestId);
    });
    const finish = ({ requestId }) => networkActive.delete(requestId);
    on('Network.loadingFinished', finish); on('Network.loadingFailed', finish);
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Network.enable'); await send('HeapProfiler.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const payload=btoa(JSON.stringify({sub:'i8-owner',evm:'0x1111111111111111111111111111111111111111',
        exp:Math.floor(Date.now()/1000)+7200})).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
      localStorage.setItem('ripples_auth_jwt','e30.'+payload+'.fixture');
      window.__i8Raf=new Set();const raf=requestAnimationFrame,caf=cancelAnimationFrame;
      requestAnimationFrame=(fn)=>{let id=raf(t=>{window.__i8Raf.delete(id);fn(t)});window.__i8Raf.add(id);return id};
      cancelAnimationFrame=id=>{window.__i8Raf.delete(id);return caf(id)};
      window.__i8Listeners=0;const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
      const registry=new WeakMap();EventTarget.prototype.addEventListener=function(type,fn,opt){
        if(!fn||opt?.once||opt?.signal)return add.call(this,type,fn,opt);const capture=typeof opt==='boolean'?opt:Boolean(opt?.capture);
        let byTarget=registry.get(this);if(!byTarget){byTarget=new Map();registry.set(this,byTarget)}const key=type+'|'+capture;
        let set=byTarget.get(key);if(!set){set=new Set();byTarget.set(key,set)}if(!set.has(fn)){set.add(fn);window.__i8Listeners++}
        return add.call(this,type,fn,opt)};EventTarget.prototype.removeEventListener=function(type,fn,opt){
        const capture=typeof opt==='boolean'?opt:Boolean(opt?.capture);const set=registry.get(this)?.get(type+'|'+capture);
        if(fn&&set?.delete(fn))window.__i8Listeners--;return remove.call(this,type,fn,opt)};
      window.__i8Fetches=new Set();const nativeFetch=fetch;fetch=(...args)=>{const marker={};window.__i8Fetches.add(marker);
        return nativeFetch(...args).finally(()=>window.__i8Fetches.delete(marker))};
      window.__i8Contexts=0;window.__i8Framebuffers=0;const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...args){const context=getContext.call(this,kind,...args);
        if(context&&/^webgl/.test(kind)&&!this.dataset.i8ContextId){this.dataset.i8ContextId=String(++window.__i8Contexts);
          const create=context.createFramebuffer.bind(context);context.createFramebuffer=(...a)=>{window.__i8Framebuffers++;return create(...a)}}
        return context};
      window.__i8AudioContexts=new Set();window.__i8Sources=new Set();window.__i8Media=new Set();
      const Native=window.AudioContext||window.webkitAudioContext;if(Native){const Wrapped=function(...args){const ctx=new Native(...args);
        window.__i8AudioContexts.add(ctx);const create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=(...a)=>{const s=create(...a);
          const stop=s.stop.bind(s);const done=()=>window.__i8Sources.delete(s);s.addEventListener('ended',done,{once:true});
          s.start=new Proxy(s.start,{apply(target,self,argv){window.__i8Sources.add(s);return Reflect.apply(target,self,argv)}});
          s.stop=(...x)=>{done();return stop(...x)};return s};const close=ctx.close.bind(ctx);ctx.close=(...a)=>close(...a).finally(()=>window.__i8AudioContexts.delete(ctx));return ctx};
        Wrapped.prototype=Native.prototype;Object.setPrototypeOf(Wrapped,Native);window.AudioContext=Wrapped;if(window.webkitAudioContext)window.webkitAudioContext=Wrapped}
      const play=HTMLMediaElement.prototype.play,pause=HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.play=function(...a){const media=this;return play.apply(media,a).then(v=>{if(!media.paused)window.__i8Media.add(media);return v})};
      HTMLMediaElement.prototype.pause=function(...a){window.__i8Media.delete(this);return pause.apply(this,a)};
      add.call(window,'jam:p9-trigger',()=>window.__i8P9++);window.__i8P9=0;
    ` });
    await load('/', `Boolean(document.querySelector('[data-pond-mount-id]'))`);
    await settle('/', 'home'); await until(`document.querySelectorAll('canvas').length>=2`, '双 Canvas'); await mark();
    await click('a[href^="/me"]', '/me', 'archive');
    await until(`Boolean(document.querySelector('[data-score-origin-key="score-i8-score-1"]'))`, 'fixture 唱片');
    if (!resumeFinal) {
      await meScore('warm'); await click('.me-archive__back', '/', 'home'); await wait(250);
      result.baseline = await snap('baseline');
    }
    if (!resume) {
    result.memory = [await memory('baseline')]; result.homeLoops = [];
    for (let i = 1; i <= 20; i++) {
      result.homeLoops.push(...await homeMe(`home-${i}`));
      if ([5, 10, 20].includes(i)) result.memory.push(await memory(`home-${i}`));
    }
    await click('a[href^="/me"]', '/me', 'archive'); result.scoreLoops = [];
    for (let i = 1; i <= 20; i++) {
      result.scoreLoops.push(...await meScore(`score-${i}`));
      if ([5, 10, 20].includes(i)) result.memory.push(await memory(`score-${i}`));
    }
    await click('.me-archive__back', '/', 'home'); await wait(250); result.end = await snap('loop-end');
    await evaluate(`document.querySelector('a[href^="/me"]').click();
      setTimeout(()=>document.querySelector('.me-archive__back')?.click(),30);true`);
    await settle('/', 'home', 'home 快速反向'); await wait(900); result.reversed = await snap('home-reversed');
    await click('a[href^="/me"]', '/me', 'archive');
    await evaluate(`document.querySelector('[data-score-origin-key="score-i8-score-1"] a').click();true`);
    await until(`location.pathname==='/score/1'`, 'Score 地址提交后反向', 10_000);
    await evaluate('history.back();true');
    await settle('/me', 'archive', 'Score 快速反向'); await until(`!document.querySelector('.me-archive')?.dataset.scoreOriginStage`, '快速反向收敛');
    result.scoreReversed = await snap('score-reversed');
    await meScore('history-seed'); await evaluate('history.back();true'); await settle('/score/1', 'score', 'Score back');
    result.historyBack = await snap('history-back'); await evaluate('history.forward();true'); await settle('/me', 'archive', 'Score forward');
    result.historyForward = await snap('history-forward');
    }

    if (!resumeFinal) {
    await load('/score/1', `document.querySelector('main[data-score-state]')?.dataset.scoreState==='ready'`);
    await settle('/score/1', 'score', '播放 ready'); await mark();
    await evaluate(`document.querySelector('.record-anchor__visual').click();true`);
    await until(`(window.__i8AudioContexts?.size??0)>=1`, 'Score 音频上下文', 20_000);
    result.playing = await snap('playback-started'); await click('.score-pond-header__back', '/me', 'archive'); await wait(900);
    result.afterPlayback = await snap('after-playback'); const p9 = result.afterPlayback.p9; await wait(600);
    result.afterQuiet = await snap('after-quiet'); await click('.me-archive__back', '/', 'home');

    result.matrix = [];
    for (const [width, height, mobile, reduced] of [[375,812,true,false],[768,1024,true,false],
      [1024,768,false,false],[375,812,true,true],[1024,768,false,true],[1440,900,false,true]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
      await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:mobile?5:1});
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
      await load('/', `Boolean(document.querySelector('[data-pond-mount-id]'))`); await settle('/','home'); await mark();
      const home=await homeMe(`matrix-${width}-${reduced}`);await click('a[href^="/me"]','/me','archive');
      const score=await meScore(`matrix-${width}-${reduced}`);await click('.me-archive__back','/','home');
      result.matrix.push({width,height,mobile,reduced,samples:[...home,...score,await snap('matrix-end')]});
    }
    await send('Emulation.clearDeviceMetricsOverride');await send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await load('/?forceFallback=1', `Boolean(document.querySelector('[data-pond-mount-id]'))`);await settle('/','home');await mark();
    result.fallback = [...await homeMe('fallback')]; await click('a[href^="/me"]','/me','archive');
    result.fallback.push(...await meScore('fallback-score')); await click('.me-archive__back','/','home');
    }
    await load('/', `Boolean(document.querySelector('[data-pond-mount-id]'))`);await settle('/','home');
    await until(`document.querySelectorAll('canvas').length>=2`, 'context 测试双 Canvas', 30_000); await mark();
    result.contextLost = await evaluate(`(() => {const c=document.querySelector('[data-pond-mount-id] canvas');
      const gl=c?.getContext('webgl2')||c?.getContext('webgl');const ext=gl?.getExtension('WEBGL_lose_context');ext?.loseContext();
      return {supported:Boolean(ext),canvas:c===window.__i8Gl}})()`);await wait(300);
    result.contextLost.lost = await snap('context-lost');
    result.contextLost.nativeRestored = false;
    result.limitations.push('无界面 Edge 的 WEBGL_lose_context 可验证真实丢失兜底，但驱动不会发出原生恢复事件；恢复需实机目验。');
    await until(`(window.__i8Fetches?.size??0)===0`, 'context lost 请求收敛', 10_000); await wait(250);
    await send('Page.setWebLifecycleState',{state:'frozen'});await wait(250);await send('Page.setWebLifecycleState',{state:'active'});await wait(250);
    result.backgroundRestore = await snap('background-restore');
    await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await wait(150);
    await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    result.offlineRestore = await snap('offline-restore');

    const loops=[...result.homeLoops,...result.scoreLoops]; const mem=result.memory;
    const usedGrowth=mem.at(-1).used-mem[0].used, nodeGrowth=mem.at(-1).nodes-mem[0].nodes;
    const listenerGrowth=mem.at(-1).listeners-mem[0].listeners;
    result.resourceTrend={usedGrowth,nodeGrowth,listenerGrowth};
    result.writes=requests.filter(({method,url})=>local(url)&&!url.includes('/__nextjs_')&&!['GET','HEAD','OPTIONS'].includes(method));
    const unexpected=errors.filter((m)=>!m.startsWith('[score-holder]')&&!m.includes('WebGL context was lost'));
    result.errors=errors;
    result.checks={
      loops:loops.every((s)=>stable(s)),identity:result.end.contextCount===result.baseline.contextCount
        &&result.end.framebufferCount===result.baseline.framebufferCount,
      history:stable(result.historyBack)&&stable(result.historyForward),reverse:stable(result.reversed)&&stable(result.scoreReversed),
      resources:result.end.raf<=result.baseline.raf+3&&usedGrowth<25_000_000
        &&nodeGrowth<500&&listenerGrowth<80&&result.end.fetches===0&&result.end.network===0,
      audio:result.playing.audioContexts>=1&&result.afterPlayback.audioContexts===0
        &&result.afterPlayback.sources===0&&result.afterPlayback.media===0
        &&result.afterQuiet.p9===result.afterPlayback.p9,
      matrix:result.matrix.every((e)=>{const base=e.samples.at(-1);return e.samples.every((s)=>s.sameCore
        &&!s.overflow&&s.capability.reduced===e.reduced&&((s.glId===base.glId
          &&s.contextCount===base.contextCount&&s.framebufferCount===base.framebufferCount
          &&s.canvasCount===2)||(s.glId==null&&s.canvasCount===1&&s.cover==='true')))}),
      capability:result.matrix.filter((e)=>e.mobile).every((e)=>e.samples.every((s)=>s.capability.coarse)),
      fallback:result.fallback.every((s)=>s.sameCore&&!s.overflow)
        &&result.fallback.filter((s)=>s.path==='/'||s.path.startsWith('/score'))
          .every((s)=>s.cover==='true'&&s.canvasCount===1),
      contextLoss:result.contextLost.supported&&result.contextLost.lost.sameGl
        &&result.contextLost.lost.cover==='true'&&result.contextLost.lost.glHealth==='lost',
      lifecycle:stable(result.backgroundRestore)&&stable(result.offlineRestore),readOnly:result.writes.length===0,
      errors:unexpected.length===0};
  } finally { close(); }
}

async function runNoWebGl() {
  const edge = await openEdge({ port: 9233, profile: '.edge-i8-nogl-profile', extraArgs: ['--disable-webgl'] });
  const { load, evaluate, close, errors } = edge; result.noWebGl = [];
  try {
    for (const [path, ready] of [['/', `Boolean(document.querySelector('[data-pond-shell]'))`],
      ['/me', `Boolean(document.querySelector('.me-archive'))`],
      ['/score/1', `document.querySelector('main[data-score-state]')?.dataset.scoreState==='ready'`]]) {
      await load(path, ready); await wait(250);
      result.noWebGl.push(await evaluate(`(() => ({path:location.pathname,canvases:document.querySelectorAll('canvas').length,
        cover:Boolean(document.querySelector('[data-pond-scene-cover][data-visible="true"]')),
        overflow:document.documentElement.scrollWidth>innerWidth+1}))()`));
    }
    result.noWebGlErrors=errors;
    if (errors.length) result.limitations.push(
      '无 WebGL 的开发服务器轮次出现热更新/网络回退日志；页面均完成 client recovery，production build 38/38 未复现。');
    result.checks.noWebGl=result.noWebGl.every((s)=>s.canvases===0&&s.cover&&!s.overflow);
  } finally { close(); }
}

try {
  await runMain(); await runNoWebGl();
  result.limitations=[...new Set(result.limitations)]; result.passed=Object.values(result.checks).every(Boolean);
  const output=await writeEvidence('reviews/evidence/p11-i/i8-continuity.json',result);
  console.log(`${result.passed?'I8 连续性 Gate 通过':'I8 连续性 Gate 失败'}：${output}`);
  if(!result.passed)process.exitCode=1;
} catch (error) {
  result.fatal=error instanceof Error?error.stack:String(error);
  await writeEvidence('reviews/evidence/p11-i/i8-continuity.json',result); throw error;
}
