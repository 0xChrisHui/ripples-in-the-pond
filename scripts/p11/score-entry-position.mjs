import { openEdge, wait, writeEvidence } from '../../reviews/evidence/p11-i/lib/edge-cdp.mjs';
import { AUTH_SOURCE } from './score-route-handoff/fixtures.mjs';
import { createRequestHarness } from './score-route-handoff/request-harness.mjs';
import { createScreencast } from './score-route-handoff/screencast.mjs';

const edge = await openEdge({ port: 9235, profile: '.edge-j0-debug' });
let harness;
try {
  await edge.send('Page.addScriptToEvaluateOnNewDocument', { source: AUTH_SOURCE });
  harness = await createRequestHarness(edge);
  const cast = createScreencast(edge, 'reviews/evidence/p11-j');
  await edge.load('/me', `Boolean(document.querySelector('[data-score-origin-key="score-j-score-1"] a'))`);
  await edge.until(`document.querySelector('.pond-prepared-archive')?.dataset.interactive === 'true'`,
    '档案可交互', 30_000);
  await cast.start();
  const source = await edge.evaluate(`(() => {
    const link = document.querySelector('[data-score-origin-key="score-j-score-1"] a');
    link.scrollIntoView({ block: 'center' });
    const before = { scrollY, path: location.pathname };
    link.click();
    return before;
  })()`);
  const samples = [];
  for (let index = 0; index < 200; index += 1) {
    samples.push(await edge.evaluate(`(() => {
      const shell = document.querySelector('[data-pond-shell]');
      return { at: Math.round(performance.now()), path: location.pathname, scrollY,
        stage: shell?.dataset.pondStage ?? null,
        scoreVisible: document.querySelector('.pond-route-surface')?.dataset.active ?? null };
    })()`));
    if (samples.at(-1).path === '/score/1'
      && samples.at(-1).stage === 'stable') break;
    await wait(50);
  }
  const shellStableAt = samples.at(-1)?.at ?? null;
  try {
    await edge.until(`location.pathname === '/score/1'
      && Boolean(document.querySelector('main[data-score-state="ready"]'))`, '真实 Score 就绪', 20_000);
  } catch (error) {
    const page = await edge.evaluate(`(() => ({ path: location.pathname,
      states: [...document.querySelectorAll('main[data-score-state]')]
        .map((node) => node.dataset.scoreState), html: document.body.innerText.slice(0, 500) }))()`);
    console.error(JSON.stringify({ page, errors: edge.errors,
      requests: edge.requests.slice(-20), intercepted: harness.state.intercepted.slice(-20) }, null, 2));
    throw error;
  }
  const ready = await edge.evaluate(`({ at: Math.round(performance.now()), scrollY })`);
  const screencast = await cast.stop('score-entry-position');
  const visual = await edge.evaluate(`(() => {
    const hero = getComputedStyle(document.querySelector('.score-pond-page__hero'));
    const archive = getComputedStyle(document.querySelector('.score-archive'));
    return { heroBackgroundImage: hero.backgroundImage,
      heroBackgroundColor: hero.backgroundColor,
      archiveBackgroundImage: archive.backgroundImage };
  })()`);
  const scoreSamples = samples.filter((sample) => sample.path === '/score/1');
  const result = {
    measuredAt: new Date().toISOString(), source, samples, shellStableAt, ready, visual, screencast,
    writes: harness.state.writes,
    passed: source.scrollY === 0 && scoreSamples.length > 0
      && scoreSamples.every((sample) => sample.scrollY === 0)
      && ready.scrollY === 0
      && visual.heroBackgroundImage === 'none'
      && visual.heroBackgroundColor === 'rgba(0, 0, 0, 0)'
      && visual.archiveBackgroundImage !== 'none'
      && screencast.blanks === 0
      && harness.state.writes.length === 0,
  };
  const output = await writeEvidence('reviews/evidence/p11-j/score-entry-position.json', result);
  console.log(`${result.passed ? 'Score 顶部进入与遮罩边界 Gate 通过' : 'Score 顶部进入与遮罩边界 Gate 失败'}：${output}`);
  if (!result.passed) process.exitCode = 1;
} finally {
  edge.close();
}
