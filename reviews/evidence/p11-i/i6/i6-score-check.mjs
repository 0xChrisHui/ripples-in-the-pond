import { mkdir, writeFile } from 'node:fs/promises';
import { openEdge, wait, writeEvidence } from '../lib/edge-cdp.mjs';

const edge = await openEdge({ port: 9228, profile: '.edge-i6-profile' });
const { send, evaluate, until, load, errors, requests, close } = edge;
const evidenceDir = 'reviews/evidence/p11-i/i6/screenshots';

async function click(selector) {
  const point = await evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return null; const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
  if (!point) throw new Error(`找不到点击目标：${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78, fromSurface: true });
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(`${evidenceDir}/${name}.jpg`, Buffer.from(data, 'base64'));
}

async function snapshot(label) {
  return evaluate(`(() => {
    const shell = document.querySelector('[data-pond-shell]');
    const root = document.querySelector('main[data-score-state]');
    const record = document.querySelector('.record-anchor');
    const visual = document.querySelector('.record-anchor__visual');
    const rect = visual?.getBoundingClientRect();
    return {
      label: ${JSON.stringify(label)}, at: performance.now(), path: location.pathname,
      phase: shell?.dataset.pondTransition ?? null,
      owner: shell?.dataset.pondSceneOwner ?? null,
      shellReady: shell?.dataset.pondSceneReady ?? null,
      mountId: shell?.dataset.pondMountId ?? null,
      sameCore: shell === window.__i6Shell,
      sameCanvas: document.querySelector('canvas') === window.__i6Canvas,
      samePetals: document.querySelectorAll('canvas')[1] === window.__i6Petals,
      canvasCount: document.querySelectorAll('canvas').length,
      scoreState: root?.dataset.scoreState ?? null,
      playback: root?.dataset.playbackState ?? null,
      glHealth: root?.dataset.glHealth ?? null,
      sceneReady: root?.dataset.sceneReady ?? null,
      eclipse: root?.dataset.pondEclipseActive ?? null,
      eclipseMix: document.body.style.getPropertyValue('--pond-eclipse-mix'),
      recordVisual: record?.dataset.visual ?? null,
      recordMotion: root?.dataset.recordMotion ?? null,
      recordRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      overflow: document.documentElement.scrollWidth > innerWidth,
      audio: { created: window.__i6AudioCreated ?? 0, closed: window.__i6AudioClosed ?? 0 },
      p9Count: window.__i6P9?.length ?? 0,
    };
  })()`);
}

async function sampleTimeline(prefix, offsets) {
  const start = Date.now();
  const samples = [];
  for (const offset of offsets) {
    await wait(Math.max(0, start + offset - Date.now()));
    samples.push(await snapshot(`${prefix}-${offset}`));
  }
  return samples;
}

async function setViewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await wait(180);
  return evaluate(`(() => { const root = document.querySelector('main[data-score-state]');
    const visual = document.querySelector('.record-anchor__visual')?.getBoundingClientRect();
    const header = document.querySelector('.score-pond-header')?.getBoundingClientRect();
    return { width: innerWidth, height: innerHeight, capability: root?.dataset.capability,
      overflow: document.documentElement.scrollWidth > innerWidth,
      touchTarget: visual ? [visual.width, visual.height] : null,
      headerRight: header?.right ?? null }; })()`);
}

const result = { measuredAt: new Date().toISOString(), routes: [], viewports: [], checks: {} };

try {
  await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__i6AudioCreated = 0; window.__i6AudioClosed = 0; window.__i6P9 = [];
    const Native = window.AudioContext || window.webkitAudioContext;
    if (Native) {
      const Wrapped = function(...args) { const context = new Native(...args); window.__i6AudioCreated += 1;
        const close = context.close.bind(context); context.close = (...closeArgs) => {
          window.__i6AudioClosed += 1; return close(...closeArgs); }; return context; };
      Wrapped.prototype = Native.prototype; Object.setPrototypeOf(Wrapped, Native);
      window.AudioContext = Wrapped; if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
    }
    addEventListener('jam:p9-trigger', event => window.__i6P9.push({ at: performance.now(), id: event.detail?.effect?.id }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async value => { window.__i6Copied = String(value); }
    }});
  ` });
  await load('/score/1', `document.querySelector('main[data-score-state]')?.dataset.scoreState === 'ready'`);
  await until(`document.querySelector('[data-pond-shell]')?.dataset.pondSceneOwner === 'score'
    && document.querySelector('main[data-score-state]')?.dataset.glHealth === 'healthy'
    && document.querySelector('main[data-score-state]')?.dataset.sceneReady === 'true'`, 'Score Scene ready', 30_000);
  await evaluate(`window.__i6Shell=document.querySelector('[data-pond-shell]');
    window.__i6Canvas=document.querySelector('canvas'); window.__i6Petals=document.querySelectorAll('canvas')[1]; true`);
  result.direct = await snapshot('direct-idle');
  result.identity = await evaluate(`(() => ({
    title: document.querySelector('h1')?.textContent, token: document.body.innerText.includes('Token #001'),
    networkText: document.querySelector('.score-pond-header__edition')?.textContent?.trim(),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    backHref: document.querySelector('.score-pond-header__back')?.getAttribute('href'),
    backText: document.querySelector('.score-pond-header__back')?.textContent?.trim(),
    ledgerRows: document.querySelectorAll('.provenance-ledger__row').length,
    archiveVisible: Boolean(document.querySelector('#score-archive-title')),
    pageBackground: getComputedStyle(document.querySelector('.score-pond-page')).backgroundColor,
  }))()`);
  await shot('score-1-idle');
  result.share = { initiallyOpen: await evaluate(`document.querySelector('.score-share-actions details')?.open`) };
  await click('.score-share-actions summary');
  result.share.opened = await evaluate(`document.querySelector('.score-share-actions details')?.open`);
  await click('.score-pond-page__identity h1');
  result.share.closedOutside = !(await evaluate(`document.querySelector('.score-share-actions details')?.open`));
  const copyExpected = await evaluate(`document.querySelector('.provenance-ledger code')?.getAttribute('title')`);
  await evaluate(`document.querySelector('.provenance-ledger__actions button')?.scrollIntoView({block:'center'}); true`);
  await wait(180);
  await click('.provenance-ledger__actions button');
  await until(`window.__i6Copied === ${JSON.stringify(copyExpected)}`, '完整凭证复制', 3_000);
  result.copy = { expected: copyExpected, actual: await evaluate('window.__i6Copied') };
  await evaluate('scrollTo(0, 0); true');
  await wait(180);

  await click('.record-anchor__visual');
  result.queued = await snapshot('after-click');
  await until(`document.querySelector('main[data-score-state]')?.dataset.playbackState === 'playing'`, 'Score playing', 30_000);
  result.playing = await sampleTimeline('playing', [0, 150, 450, 1500]);
  await shot('score-1-playing');
  await click('.record-anchor__visual');
  await until(`document.querySelector('main[data-score-state]')?.dataset.playbackState === 'paused'`, 'Score paused', 8_000);
  result.paused = await sampleTimeline('paused', [0, 150, 450, 1500]);
  await click('.record-anchor__visual');
  await until(`document.querySelector('main[data-score-state]')?.dataset.playbackState === 'playing'`, 'Score resumed', 8_000);
  result.resumed = await snapshot('resumed');
  await evaluate(`document.querySelector('[role="slider"][aria-label="播放进度"]')?.focus(); true`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await until(`document.querySelector('main[data-score-state]')?.dataset.playbackState === 'ended'`, 'Score ended', 12_000);
  result.ended = await snapshot('ended');
  await click('.record-anchor__visual');
  await until(`document.querySelector('main[data-score-state]')?.dataset.playbackState === 'playing'`, 'Score replay', 12_000);
  result.replayed = await snapshot('replayed');

  const scrollBefore = await evaluate('scrollY');
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 520, deltaX: 0, deltaY: 620 });
  await wait(300);
  result.scroll = { before: scrollBefore, after: await evaluate('scrollY') };
  await evaluate('scrollTo(0, 0); true');
  await wait(180);
  await click('.score-pond-header__back');
  await until(`location.pathname === '/me' && document.querySelector('[data-pond-shell]')?.dataset.pondTransition === 'archive'`, '返回档案', 20_000);
  result.archiveReturn = await snapshot('archive-return');
  await wait(500);
  result.afterLeave = await snapshot('after-leave');
  await evaluate('history.back(); true');
  await until(`location.pathname === '/score/1'
    && document.querySelector('[data-pond-shell]')?.dataset.pondSceneOwner === 'score'
    && document.querySelector('main[data-score-state]')?.dataset.sceneReady === 'true'`, 'history 返回 Score', 30_000);
  result.historyReturn = await snapshot('history-return');

  for (const token of [1, 2, 3, 4]) {
    await load(`/score/${token}`, `document.querySelector('main[data-score-state]')?.dataset.scoreState === 'ready'`);
    await until(`document.querySelector('[data-pond-shell]')?.dataset.pondSceneOwner === 'score'`, `Score #${token} owner`, 20_000);
    result.routes.push(await evaluate(`(() => ({ token: ${token}, status: document.querySelector('main[data-score-state]')?.dataset.scoreState,
      title: document.querySelector('h1')?.textContent, canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      overflow: document.documentElement.scrollWidth > innerWidth, errors: window.__i6PageErrors ?? [] }))()`));
  }

  await load('/score/1', `document.querySelector('main[data-score-state]')?.dataset.scoreState === 'ready'`);
  for (const [width, height, mobile] of [[375, 812, true], [768, 1024, true], [1024, 768, false], [1440, 900, false]]) {
    result.viewports.push(await setViewport(width, height, mobile));
  }
  await shot('score-1-1440');

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load('/score/1', `document.querySelector('main[data-score-state]')?.dataset.scoreState === 'ready'`);
  await until(`document.querySelector('[data-pond-shell]')?.dataset.pondSceneOwner === 'score'`, 'reduced Score owner', 20_000);
  await click('.record-anchor__visual');
  await until(`document.querySelector('main[data-score-state]')?.dataset.playbackState === 'playing'`, 'reduced playing', 30_000);
  await wait(180);
  result.reduced = await snapshot('reduced-playing');

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await load('/score/1?forceFallback=1', `document.querySelector('main[data-score-state]')?.dataset.scoreState === 'ready'`);
  await until(`document.querySelector('[data-pond-shell]')?.dataset.pondSceneOwner === 'score'`, 'fallback Score owner', 20_000);
  result.fallback = await snapshot('forced-fallback');
  await click('.record-anchor__visual');
  await wait(300);
  result.fallbackAfterClick = await snapshot('forced-fallback-click');

  const sameOriginWrites = requests.filter(({ method, url }) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && url.startsWith('http://127.0.0.1:3000'));
  result.requests = { sameOriginWrites, total: requests.length };
  result.errors = errors;
  const unexpectedErrors = errors.filter((message) => !message.startsWith('[score-holder]'));
  result.expectedFallbackErrors = errors.filter((message) => message.startsWith('[score-holder]'));
  result.checks = {
    identity: result.identity.title === 'Ripples #1' && result.identity.token
      && result.identity.networkText?.includes('OP Mainnet')
      && result.identity.backHref === '/me' && result.identity.backText.includes('返回档案')
      && result.identity.canonical === '/score/1' && result.identity.ledgerRows === 12
      && result.identity.archiveVisible && result.identity.pageBackground === 'rgba(0, 0, 0, 0)',
    uniqueCore: result.direct.canvasCount === 2 && result.playing.every((item) => item.canvasCount === 2
      && item.sameCore && item.sameCanvas && item.samePetals && item.owner === 'score'),
    eclipse: result.playing.at(-1).eclipse === 'true' && Number(result.playing.at(-1).eclipseMix) >= 0.95
      && result.playing.at(-1).recordVisual === 'eclipse',
    audioAndP9: result.queued.audio.created === 1 && result.playing.at(-1).p9Count > 0,
    pauseReturn: result.paused.at(-1).eclipse === 'false' && Number(result.paused.at(-1).eclipseMix || 0) <= 0.05
      && result.paused.at(-1).recordMotion === 'resting',
    playbackLifecycle: result.resumed.playback === 'playing' && result.ended.playback === 'ended'
      && result.replayed.playback === 'playing',
    scroll: result.scroll.after > result.scroll.before,
    reading: !result.share.initiallyOpen && result.share.opened && result.share.closedOutside
      && result.copy.expected === result.copy.actual,
    continuity: result.archiveReturn.sameCore && result.archiveReturn.sameCanvas && result.archiveReturn.samePetals
      && result.historyReturn.sameCore && result.historyReturn.sameCanvas && result.historyReturn.samePetals,
    routeMatrix: result.routes.every((item) => item.status === 'ready'
      && item.title === `Ripples #${item.token}` && !item.overflow),
    viewports: result.viewports.every((item) => !item.overflow && item.headerRight <= item.width
      && item.touchTarget?.[0] >= 44 && item.touchTarget?.[1] >= 44),
    reduced: result.reduced.sceneReady === 'true' && result.reduced.eclipse === 'true'
      && Number(result.reduced.eclipseMix) >= 0.95,
    fallback: result.fallback.glHealth === 'forced' && result.fallback.recordVisual === 'record'
      && ['loading', 'playing'].includes(result.fallbackAfterClick.playback),
    cleanup: result.afterLeave.audio.closed >= result.afterLeave.audio.created
      && result.afterLeave.p9Count === result.archiveReturn.p9Count,
    readOnly: sameOriginWrites.length === 0,
    errors: unexpectedErrors.length === 0,
  };
  result.passed = Object.values(result.checks).every(Boolean);
  const output = await writeEvidence('reviews/evidence/p11-i/i6/i6-score.json', result);
  console.log(`${result.passed ? 'I6 Score Gate 通过' : 'I6 Score Gate 失败'}：${output}`);
  if (!result.passed) process.exitCode = 1;
} finally {
  close();
}
