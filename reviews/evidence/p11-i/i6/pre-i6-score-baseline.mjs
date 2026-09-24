import { openEdge, wait, writeEvidence } from '../lib/edge-cdp.mjs';

const edge = await openEdge({ port: 9227, profile: '.edge-i6-profile' });
const { send, evaluate, until, load, errors, requests, close } = edge;

async function snapshot(label) {
  return evaluate(`(() => {
    const root = document.querySelector('main[data-score-state]');
    const record = document.querySelector('.record-anchor');
    const visual = document.querySelector('.record-anchor__visual');
    const style = record ? getComputedStyle(record) : null;
    return {
      label: ${JSON.stringify(label)},
      at: performance.now(),
      path: location.pathname,
      scoreState: root?.dataset.scoreState ?? null,
      playback: root?.dataset.playbackState ?? null,
      glHealth: root?.dataset.glHealth ?? null,
      eclipse: root?.dataset.pondEclipseActive ?? null,
      eclipseMix: getComputedStyle(document.documentElement).getPropertyValue('--pond-eclipse-mix').trim(),
      recordVisual: visual?.getAttribute('data-visual') ?? null,
      recordMotion: root?.dataset.recordMotion ?? null,
      recordOpacity: style?.opacity ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      audioContexts: window.__p11AudioContexts ?? 0,
      p9Count: window.__p11P9?.length ?? 0,
    };
  })()`);
}

async function click(selector) {
  const point = await evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return null; const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
  if (!point) throw new Error(`找不到 ${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__p11AudioContexts = 0; window.__p11P9 = [];
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (NativeAudioContext) {
      const WrappedAudioContext = function(...args) { window.__p11AudioContexts += 1; return new NativeAudioContext(...args); };
      WrappedAudioContext.prototype = NativeAudioContext.prototype;
      Object.setPrototypeOf(WrappedAudioContext, NativeAudioContext);
      window.AudioContext = WrappedAudioContext;
      if (window.webkitAudioContext) window.webkitAudioContext = WrappedAudioContext;
    }
    addEventListener('jam:p9-trigger', event => window.__p11P9.push({ at: performance.now(), detail: event.detail }));
  ` });
  await load('/score/1', `document.querySelector('main[data-score-state]')?.dataset.scoreState === 'ready'`);
  await until(`document.querySelector('main[data-score-state]')?.dataset.glHealth === 'healthy'`, 'Score WebGL healthy', 30_000);
  const initial = await snapshot('idle');
  await click('.record-anchor__visual');
  const start = Date.now();
  const samples = [];
  for (const target of [0, 150, 450, 1500]) {
    await wait(Math.max(0, start + target - Date.now()));
    samples.push(await snapshot(`play-${target}`));
  }
  const result = {
    measuredAt: new Date().toISOString(),
    baseline: 'pre-I6-local-same-tree',
    initial,
    samples,
    requests: requests.filter(({ url }) => url.startsWith('http://127.0.0.1:3000')),
    errors,
  };
  const output = await writeEvidence('reviews/evidence/p11-i/i6/pre-i6-score.json', result);
  console.log(`I6 迁移前基线已写入：${output}`);
} finally {
  close();
}
