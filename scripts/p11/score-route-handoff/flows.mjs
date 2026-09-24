import { wait } from '../../../reviews/evidence/p11-i/lib/edge-cdp.mjs';
import { addClockSamples } from './telemetry.mjs';

const SCORE_ROW = '[data-score-origin-key="score-j-score-1"] a';

async function click(edge, selector) {
  const found = await edge.evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false; node.click(); return true; })()`);
  if (!found) throw new Error(`找不到入口：${selector}`);
}

async function archive(edge) {
  await edge.load('/me', `Boolean(document.querySelector(${JSON.stringify(SCORE_ROW)}))`);
  await edge.until(`document.querySelector('.pond-prepared-archive')?.dataset.interactive==='true'`, '档案可交互', 30_000);
  await edge.until(`document.querySelectorAll('canvas').length >= 2
    && document.querySelector('[data-pond-shell]')?.dataset.pondSceneReady==='true'`,
  '持久 Water Core 就绪', 30_000);
}

async function score(edge) {
  await edge.until(`location.pathname==='/score/1' && Boolean(document.querySelector('main[data-score-state], .score-fallback'))`,
    'Score 视觉主体', 60_000);
}

async function home(edge) {
  await edge.until(`location.pathname==='/' && document.querySelector('.pond-home-surface')?.dataset.active==='true'`,
    '首页视觉主体', 30_000);
}

async function disableViewTransition(edge) {
  await edge.evaluate(`(() => { try { Object.defineProperty(document, 'startViewTransition', {
    value: undefined, configurable: true }); } catch { document.startViewTransition = undefined; }
    return typeof document.startViewTransition === 'undefined'; })()`);
}

async function finish(edge, target, cold) {
  if (target === 'score') await score(edge);
  else if (target === 'archive') await archiveReady(edge);
  else await home(edge);
  await wait(cold ? 1_650 : 1_550);
  return addClockSamples(await edge.evaluate('window.__p11J.end()'));
}

async function archiveReady(edge) {
  await edge.until(`location.pathname==='/me' && document.querySelector('.pond-prepared-archive')?.dataset.interactive==='true'`,
    '档案返回收敛', 30_000);
}

async function seedScore(edge, noViewTransition) {
  await archive(edge); if (noViewTransition) await disableViewTransition(edge);
  await click(edge, SCORE_ROW); await score(edge); await wait(700);
}

async function runTrace(edge, cast, options, source, target, trigger) {
  const label = `${options.label}-${source}-to-${target}`;
  if (options.noViewTransition) await disableViewTransition(edge);
  await cast.start(); let stopped = false;
  try {
    await edge.evaluate(`window.__p11J.begin(${JSON.stringify(label)}, ${JSON.stringify(source)}, ${JSON.stringify(target)})`);
    options.harness.activateCold();
    const screenshots = options.cold ? (async () => {
      await wait(1_900); await cast.screenshot(`${label}-intent-1900.jpg`);
    })() : Promise.resolve();
    const triggerKind = await trigger();
    const trace = await finish(edge, target, options.cold);
    await screenshots;
    const screencast = await cast.stop(label); stopped = true;
    const cold = await options.harness.disarmCold();
    return { label, source, target, trigger: triggerKind, fixture: true,
      viewTransition: options.noViewTransition ? 'disabled' : 'supported', cold, trace, screencast };
  } finally {
    if (!stopped) await cast.stop(`${label}-failed`).catch(() => undefined);
    await options.harness.disarmCold();
  }
}

export async function meToScore(edge, cast, options) {
  if (options.cold) options.harness.armCold('/score/1', 2_000);
  await archive(edge);
  return runTrace(edge, cast, options, 'archive', 'score', async () => {
    await click(edge, SCORE_ROW); return 'archive-row';
  });
}

export async function scoreToMe(edge, cast, options) {
  await seedScore(edge, options.noViewTransition);
  return runTrace(edge, cast, options, 'score', 'archive', async () => {
    await click(edge, '.score-pond-header__back'); return 'score-back';
  });
}

export async function scoreToHome(edge, cast, options) {
  await edge.load('/', `Boolean(document.querySelector('.pond-home-surface'))`);
  await click(edge, 'a[href^="/me"]'); await archiveReady(edge);
  await click(edge, SCORE_ROW); await score(edge); await wait(700);
  return runTrace(edge, cast, options, 'score', 'home', async () => {
    const direct = await edge.evaluate(`(() => { const link = document.querySelector(
      '[data-score-home-link], .score-pond-header__home, .score-pond-header a[href="/"]');
      if (!link) return false; link.click(); return true; })()`);
    if (direct) return 'score-home-control';
    await edge.evaluate('history.go(-2); true'); return 'history.go(-2):missing-home-control';
  });
}
