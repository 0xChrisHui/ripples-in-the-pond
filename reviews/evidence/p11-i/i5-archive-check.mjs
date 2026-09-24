import { BASE, CANVAS_READY, openEdge, wait, writeEvidence } from './lib/edge-cdp.mjs';

const edge = await openEdge({ port: 9225, profile: '.edge-i5-profile' });
const { send, evaluate, until, load, errors, requests } = edge;
const privateApi = /\/api\/me\/(?:scores|score-nfts|nfts|pond-echoes)/;

async function trustedClick(selector) {
  const point = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) return false;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  return true;
}

async function snapshot() {
  return evaluate(`(() => {
    const shell = document.querySelector('[data-pond-shell]');
    const prepared = document.querySelector('.pond-prepared-archive');
    const archive = document.querySelector('.me-archive');
    return {
      path: location.pathname,
      phase: shell?.dataset.pondTransition ?? null,
      archiveReady: shell?.querySelector('.pond-prepared-archive')?.dataset.prepared ?? null,
      archiveCount: document.querySelectorAll('.me-archive').length,
      sameArchive: archive === window.__p11Archive,
      inert: Boolean(prepared?.inert),
      ariaHidden: prepared?.getAttribute('aria-hidden'),
      active: prepared?.dataset.active ?? null,
      interactive: prepared?.dataset.interactive ?? null,
      loginCopy: document.body.innerText.includes('登录后找回你的音乐'),
      dashboardVisible: Boolean(document.querySelector('.me-archive__dashboard')),
      canvasCount: document.querySelectorAll('canvas').length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      rippleInputs: Number(shell?.dataset.pondRippleInputs ?? 0),
    };
  })()`);
}

let result;
try {
  await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__p11LongTasks = [];
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
      window.__p11LongTasks.push({ t: Math.round(entry.startTime), ms: Math.round(entry.duration) });
    })).observe({ type: 'longtask', buffered: true });
    window.__p11AudioStarts = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) { window.__p11AudioStarts += 1; return start.apply(this, args); };
  ` });
  await load('/', CANVAS_READY);
  await until(`document.querySelector('.me-archive[data-archive-prepared="true"]')
    && document.querySelector('.pond-prepared-archive')?.dataset.prepared==='true'`,
  '未登录档案在首页预备完成', 60_000);
  await evaluate(`window.__p11Archive=document.querySelector('.me-archive'); true`);
  const home = await snapshot();
  const performance = await evaluate(`(() => {
    const circle = performance.getEntriesByName('p15:first-circles-painted').at(-1)?.startTime ?? null;
    const prepared = performance.now();
    const tasks = window.__p11LongTasks ?? [];
    return { firstCirclesMs: circle, archivePreparedMs: prepared,
      longTaskCount: tasks.length, longTaskMaxMs: Math.max(0, ...tasks.map((task) => task.ms)), tasks };
  })()`);

  if (!await trustedClick('a[href="/me#pond-echoes"]')) throw new Error('首页档案入口不存在');
  await until(`location.pathname==='/me'
    && document.querySelector('[data-pond-shell]')?.dataset.pondTransition==='archive'`,
  '进入预备档案', 30_000);
  const archive = await snapshot();

  const viewports = [];
  for (const viewport of [
    { width: 375, height: 812, mobile: true },
    { width: 768, height: 1024, mobile: true },
    { width: 1024, height: 768, mobile: false },
    { width: 1440, height: 900, mobile: false },
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
    });
    await wait(120);
    viewports.push(await evaluate(`(() => ({
      width: innerWidth, height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      archiveRight: document.querySelector('.me-archive__inner')?.getBoundingClientRect().right ?? null,
      loginButtonSize: (() => { const node=[...document.querySelectorAll('.me-archive button')]
        .find((item)=>item.textContent?.trim()==='登录' && item.getClientRects().length>0);
        const r=node?.getBoundingClientRect();
        return r ? [r.width,r.height] : null; })(),
      loginButtonStyle: (() => { const node=[...document.querySelectorAll('.me-archive button')]
        .find((item)=>item.textContent?.trim()==='登录' && item.getClientRects().length>0);
        if (!node) return null; const style=getComputedStyle(node);
        return { height:style.height,minHeight:style.minHeight,transform:style.transform,
          target:getComputedStyle(document.documentElement).getPropertyValue('--p11-touch-target') }; })(),
    }))()`));
  }
  await send('Emulation.clearDeviceMetricsOverride');

  const beforeKey = await evaluate(`({ audio: window.__p11AudioStarts,
    drafts: localStorage.getItem('ripples_drafts'), pressed: document.body.innerText.includes('A') })`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65 });
  await wait(160);
  const afterKey = await evaluate(`({ audio: window.__p11AudioStarts,
    drafts: localStorage.getItem('ripples_drafts'), pressedBadge: [...document.querySelectorAll('span')]
      .some((node)=>node.textContent?.trim()==='A' && node.getClientRects().length>0) })`);

  if (!await trustedClick('.me-archive__back')) throw new Error('档案返回入口不存在');
  await until(`location.pathname==='/'
    && document.querySelector('[data-pond-shell]')?.dataset.pondTransition==='home'`,
  '返回首页', 30_000);
  const returned = await snapshot();

  await load('/me/test', CANVAS_READY);
  await until(`Boolean(document.querySelector('.me-pond__controls input[type="range"]'))`, '档案调参页');
  await until(`document.querySelector('[data-pond-root]')?.dataset.sceneReady==='true'`, '调参页水面就绪', 30_000);
  const veilPointerEvents = await evaluate(`getComputedStyle(document.querySelector('.me-pond__veil')).pointerEvents`);
  const beforeBackground = await snapshot();
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 8, y: 400, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 8, y: 400, button: 'left', clickCount: 1 });
  await wait(80);
  const afterBackground = await snapshot();
  const beforeControls = afterBackground.rippleInputs;
  await trustedClick('.me-pond__controls button');
  await trustedClick('.me-pond__controls input[type="range"]');
  await wait(80);
  const afterControls = await snapshot();
  const veil = {
    pointerEvents: veilPointerEvents,
    backgroundDelta: afterBackground.rippleInputs - beforeBackground.rippleInputs,
    controlsDelta: afterControls.rippleInputs - beforeControls,
    enabled: await evaluate(`document.querySelector('.me-pond__controls button')?.getAttribute('aria-pressed')==='true'`),
  };

  const privateRequests = requests.filter((request) => privateApi.test(request.url));
  const writeRequests = requests.filter((request) => new URL(request.url).origin === new URL(BASE).origin
    && !['GET', 'HEAD', 'OPTIONS'].includes(request.method));
  const viewportPass = viewports.every((item) => !item.overflow
    && item.archiveRight <= item.width + 1
    && (!item.loginButtonSize || (item.loginButtonSize[0] >= 44 && item.loginButtonSize[1] >= 44)));
  const passed = home.archiveCount === 1 && home.inert && home.ariaHidden === 'true'
    && home.active === 'false' && home.interactive === 'false' && home.canvasCount >= 1
    && archive.archiveCount === 1 && archive.sameArchive && !archive.inert
    && archive.active === 'true' && archive.interactive === 'true'
    && archive.loginCopy && !archive.dashboardVisible && !archive.overflow
    && returned.sameArchive && returned.archiveCount === 1
    && privateRequests.length === 0 && writeRequests.length === 0
    && viewportPass && afterKey.audio === beforeKey.audio
    && afterKey.drafts === beforeKey.drafts && !afterKey.pressedBadge
    && veil.pointerEvents === 'none' && veil.backgroundDelta > 0
    && veil.controlsDelta === 0 && veil.enabled && errors.length === 0;
  result = { measuredAt: new Date().toISOString(), passed, home, archive, returned,
    performance, viewports, keyboard: { before: beforeKey, after: afterKey }, veil,
    privateRequests, writeRequests, pageErrors: errors };
} finally {
  edge.close();
}

const output = await writeEvidence('reviews/evidence/p11-i/i5-archive.json', result);
if (!result?.passed) throw new Error(`I5 档案 Gate 未通过：${output}`);
console.log(`I5 档案 Gate 通过：${output}`);
