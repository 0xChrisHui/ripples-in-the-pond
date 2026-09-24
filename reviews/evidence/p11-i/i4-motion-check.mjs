import { CANVAS_READY, MARK_CORE, SHELL_SNAPSHOT, openEdge, wait, writeEvidence } from './lib/edge-cdp.mjs';

// P11-I4：音乐圆圈连续进退场 Gate。只播放公开音频、点击站内链接，不触发写操作。
const edge = await openEdge();
const { send, evaluate, until, load, errors } = edge;
const phaseIs = (phase) => `document.querySelector('[data-pond-shell]')?.dataset.pondTransition===${JSON.stringify(phase)}`;
const CLICK_ECHO = `(() => {
  const link = [...document.querySelectorAll('a[href="/me#pond-echoes"]')]
    .find((node) => node.getClientRects().length > 0);
  if (!link) return false; link.click(); return true;
})()`;
const CLICK_BACK = `(() => {
  const link = document.querySelector('.me-archive__back');
  if (!link) return false; link.click(); return true;
})()`;

async function frame(label, targetMs, startedAt) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < targetMs) await wait(targetMs - elapsed);
  return evaluate(`(() => {
    const layer = document.querySelector('[data-scene-presence]');
    const sphere = document.querySelector('button[data-render-node-id]');
    const home = document.querySelector('main[data-pond-root]');
    const route = document.querySelector('.pond-route-surface');
    const rect = sphere?.getBoundingClientRect();
    return {
      label: ${JSON.stringify(label)}, targetMs: ${targetMs}, t: ${Date.now()} - ${startedAt},
      phase: document.querySelector('[data-pond-shell]')?.dataset.pondTransition ?? null,
      presence: Number(layer?.dataset.scenePresence ?? 'NaN'),
      waveCount: Number(layer?.dataset.waveCount ?? '0'),
      waveSpawn: Number(layer?.dataset.waveSpawn ?? 'NaN'),
      waveAge: Number(layer?.dataset.waveAge ?? 'NaN'),
      homeOpacity: Number(home ? getComputedStyle(home).opacity : 'NaN'),
      routeOpacity: Number(route ? getComputedStyle(route).opacity : 'NaN'),
      sphereOpacity: Number(sphere ? getComputedStyle(sphere).opacity : 'NaN'),
      sphereTransform: sphere?.style.transform ?? null,
      sphereWidth: rect?.width ?? null,
      sameSphere: sphere === window.__p11Sphere,
      path: location.pathname,
    };
  })()`);
}

async function sequence(click, prefix, targets = [0, 120, 260, 520]) {
  const startedAt = Date.now();
  if (!await evaluate(click)) throw new Error(`找不到 ${prefix} 导航入口`);
  const samples = [];
  for (const target of targets) {
    samples.push(await frame(`${prefix}-${target}`, target, startedAt));
  }
  return samples;
}

async function trustedClick(selector) {
  const rect = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!rect) return false;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  return true;
}

const monotonic = (values, direction) => values.every((value, index) => index === 0
  || (direction === 'down' ? value <= values[index - 1] + 0.08 : value + 0.08 >= values[index - 1]));

let result;
try {
  await load('/', CANVAS_READY);
  await until(`document.querySelector('[data-all-circles-interactive="true"]')
    && document.querySelector('[data-scene-presence]')?.dataset.scenePresence`, '圆圈稳定', 60_000);
  await evaluate(MARK_CORE);
  await evaluate(`window.__p11Sphere=document.querySelector('button[data-render-node-id]'); true`);

  // 先暖路由，排除首次编译和档案取数对逐帧采样的影响。
  await evaluate(CLICK_ECHO);
  await until(`location.pathname==='/me' && ${phaseIs('archive')}`, '暖身进入档案', 60_000);
  await evaluate(CLICK_BACK);
  await until(`location.pathname==='/' && ${phaseIs('home')}`, '暖身返回首页', 60_000);
  await wait(300);

  const initial = await evaluate(`(() => ({
    ...(${SHELL_SNAPSHOT}),
    ids: [...document.querySelectorAll('button[data-render-node-id]')].map((node) => node.dataset.renderNodeId),
    widths: [...document.querySelectorAll('button[data-render-node-id]')].slice(0, 8)
      .map((node) => node.getBoundingClientRect().width),
    centers: [...document.querySelectorAll('button[data-render-node-id]')].map((node) => {
      const rect = node.getBoundingClientRect(); return [rect.x + rect.width / 2, rect.y + rect.height / 2];
    }),
    featuredPresent: Boolean(document.querySelector('[data-featured-echo-hit]')),
  }))()`);
  await evaluate(`window.dispatchEvent(new CustomEvent('bg-ripple:wave', {
    detail: { x: innerWidth * 0.48, y: innerHeight * 0.5, size: 520, duration: 18 }
  })); true`);
  await until(`Number(document.querySelector('[data-scene-presence]')?.dataset.waveCount ?? 0)>0`, '涟漪进入场景');

  const leaving = await sequence(CLICK_ECHO, 'leaving');
  await until(`location.pathname==='/me' && ${phaseIs('archive')}`, '圆圈退场完成', 60_000);
  const archive = await evaluate(`({ ...(${SHELL_SNAPSHOT}),
    presence: Number(document.querySelector('[data-scene-presence]')?.dataset.scenePresence ?? 'NaN'),
    waveCount: Number(document.querySelector('[data-scene-presence]')?.dataset.waveCount ?? '0'),
    waveSpawn: Number(document.querySelector('[data-scene-presence]')?.dataset.waveSpawn ?? 'NaN'),
    waveAge: Number(document.querySelector('[data-scene-presence]')?.dataset.waveAge ?? 'NaN') })`);
  const entering = await sequence(CLICK_BACK, 'entering');
  await until(`location.pathname==='/' && ${phaseIs('home')}`, '圆圈回场完成', 60_000);
  await wait(180);
  const returned = await evaluate(`(() => ({
    ...(${SHELL_SNAPSHOT}),
    presence: Number(document.querySelector('[data-scene-presence]')?.dataset.scenePresence ?? 'NaN'),
    sameSphere: document.querySelector('button[data-render-node-id]')===window.__p11Sphere,
    ids: [...document.querySelectorAll('button[data-render-node-id]')].map((node) => node.dataset.renderNodeId),
    widths: [...document.querySelectorAll('button[data-render-node-id]')].slice(0, 8)
      .map((node) => node.getBoundingClientRect().width),
    centers: [...document.querySelectorAll('button[data-render-node-id]')].map((node) => {
      const rect = node.getBoundingClientRect(); return [rect.x + rect.width / 2, rect.y + rect.height / 2];
    }),
    featuredPresent: Boolean(document.querySelector('[data-featured-echo-hit]')),
  }))()`);

  // I3 路由可反向之外，I4 的圆圈 presence 也必须从当前帧连续反向，不能先跳终态。
  const reverseLeaveStarted = Date.now();
  await evaluate(CLICK_ECHO);
  await wait(180);
  await until(`Boolean(document.querySelector('.me-archive__back')) && ${phaseIs('leaving-home')}`,
    '反向前档案入口出现');
  const reverseBefore = await frame('reverse-before', 0, reverseLeaveStarted);
  const reverseStarted = Date.now();
  if (!await evaluate(CLICK_BACK)) throw new Error('反向 Gate 找不到返回池塘入口');
  const reverseFrames = [];
  for (const target of [0, 120, 260, 520]) {
    reverseFrames.push(await frame(`reverse-${target}`, target, reverseStarted));
  }
  await until(`location.pathname==='/' && ${phaseIs('home')}`, '圆圈反向回场完成', 30_000);
  const reversePresence = reverseFrames.map((sample) => sample.presence).filter(Number.isFinite);
  const reverse = { before: reverseBefore, frames: reverseFrames };

  let playback = { started: false, survivesArchive: false, survivesReturn: false, attempts: 0 };
  for (let attempt = 1; attempt <= 3 && !playback.started; attempt += 1) {
    playback.attempts = attempt;
    const selector = `button[data-render-node-id]:nth-of-type(${attempt})`;
    if (!await trustedClick(selector)) continue;
    await wait(180);
    playback.started = await evaluate(`document.querySelector('.bottom-player-shell')?.dataset.playing==='true'`);
  }
  if (playback.started) {
    await evaluate(CLICK_ECHO);
    await until(`location.pathname==='/me' && ${phaseIs('archive')}`, '播放中进入档案', 60_000);
    playback.survivesArchive = await evaluate(`document.querySelector('.bottom-player-shell')?.dataset.playing==='true'`);
    await evaluate(CLICK_BACK);
    await until(`location.pathname==='/' && ${phaseIs('home')}`, '播放中返回首页', 60_000);
    playback.survivesReturn = await evaluate(`document.querySelector('.bottom-player-shell')?.dataset.playing==='true'`);
    await evaluate(`document.querySelector('.bottom-player-shell button[aria-label^="停止播放"]')?.click(); true`);
  }

  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await load('/', CANVAS_READY);
  await until(`Number.parseInt(getComputedStyle(document.querySelector('[data-pond-shell]'))
    .getPropertyValue('--pond-route-duration'))<=160
    && document.querySelector('[data-pond-shell]')?.dataset.pondReducedSceneMotion==='true'`,
  'reduced-motion 时长同步');
  // reload 后重新暖两向路由，避免把首次 RSC 取数算进 160ms 圆圈动画。
  await evaluate(CLICK_ECHO);
  await until(`location.pathname==='/me' && ${phaseIs('archive')}`, 'reduced-motion 暖身进入档案', 30_000);
  await evaluate(CLICK_BACK);
  await until(`location.pathname==='/' && ${phaseIs('home')}`, 'reduced-motion 暖身返回首页', 30_000);
  await wait(180);
  const reducedDuration = await evaluate(`getComputedStyle(document.querySelector('[data-pond-shell]'))
    .getPropertyValue('--pond-route-duration').trim()`);
  await evaluate(`window.__p11Sphere=document.querySelector('button[data-render-node-id]'); true`);
  const reducedStarted = Date.now();
  const reducedFrames = await sequence(CLICK_ECHO, 'reduced', [0, 80, 160]);
  await until(`location.pathname==='/me' && ${phaseIs('archive')}`, 'reduced-motion 进入档案', 30_000);
  const reduced = {
    duration: reducedDuration,
    settleMs: Date.now() - reducedStarted,
    sceneMotionReduced: await evaluate(`document.querySelector('[data-pond-shell]')?.dataset.pondReducedSceneMotion==='true'`),
    frames: reducedFrames,
  };

  const leavePresence = leaving.map((sample) => sample.presence).filter(Number.isFinite);
  const enterPresence = entering.map((sample) => sample.presence).filter(Number.isFinite);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const sizeRatio = mean(returned.widths) / mean(initial.widths);
  const meanDisplacement = mean(returned.centers.map((point, index) => Math.hypot(
    point[0] - initial.centers[index][0], point[1] - initial.centers[index][1],
  )));
  const timely = (samples) => samples.every((sample) => sample.t <= sample.targetMs + 180);
  const reducedWidths = reduced.frames.map((sample) => sample.sphereWidth).filter(Number.isFinite);
  const reducedWidthRatio = Math.max(...reducedWidths) / Math.max(1, Math.min(...reducedWidths));
  const passed = initial.ids.length > 0
    && initial.sameCore && initial.sameCanvas
    && leaving.every((sample) => sample.sameSphere && sample.waveCount > 0)
    && entering.every((sample) => sample.sameSphere && sample.waveCount > 0)
    && timely(leaving) && timely(entering)
    && monotonic(leavePresence, 'down') && monotonic(enterPresence, 'up')
    && leavePresence[0] >= 0.95 && leavePresence.at(-1) <= 0.1
    && enterPresence[0] <= 0.05 && enterPresence.at(-1) >= 0.9
    && reverseBefore.presence > 0.05 && reverseBefore.presence < 0.95
    && timely(reverseFrames) && monotonic(reversePresence, 'up')
    && reversePresence.at(-1) >= 0.9 && reverseFrames.every((sample) => sample.sameSphere)
    && archive.presence <= 0.01 && returned.presence >= 0.99
    && archive.waveCount > 0 && archive.waveSpawn === leaving[0].waveSpawn
    && archive.waveAge > leaving[0].waveAge && returned.sameSphere
    && JSON.stringify(initial.ids) === JSON.stringify(returned.ids)
    && sizeRatio >= 0.75 && sizeRatio <= 1.3 && meanDisplacement < 200
    && (!initial.featuredPresent || returned.featuredPresent)
    && playback.started && playback.survivesArchive && playback.survivesReturn
    && Number.parseInt(reduced.duration, 10) <= 160 && reduced.sceneMotionReduced && reduced.settleMs < 1000
    && timely(reduced.frames) && reduced.frames[0].presence >= 0.95
    && reduced.frames.at(-1).presence <= 0.1 && reducedWidthRatio <= 1.1
    && errors.length === 0;
  result = { measuredAt: new Date().toISOString(), passed, initial, leaving, archive, entering,
    returned, reverse, sizeRatio, meanDisplacement, playback, reduced, reducedWidthRatio, pageErrors: errors };
} finally {
  edge.close();
}

const output = await writeEvidence('reviews/evidence/p11-i/i4-motion.json', result);
if (!result?.passed) throw new Error(`I4 圆圈动态 Gate 未通过：${output}`);
console.log(`I4 圆圈动态 Gate 通过：${output}`);
