import { openEdge, wait, writeEvidence } from '../p11-i/lib/edge-cdp.mjs';
import { AUTH_SOURCE } from '../../../scripts/p11/score-route-handoff/fixtures.mjs';
import { createRequestHarness } from '../../../scripts/p11/score-route-handoff/request-harness.mjs';
import { PROBE_SOURCE } from '../../../scripts/p11/score-route-handoff/telemetry.mjs';

// 复用现有浏览器工具及档案夹具；所有产品写请求由原有 harness 拒绝。
const edge = await openEdge({ port: 9235,
  profile: 'E:/Projects/nft-music-p11-i/.edge-j0-debug',
  extraArgs: ['--autoplay-policy=no-user-gesture-required'] });
const result = { revision: 'P11 review 修复工作区', measuredAt: new Date().toISOString(), checks: {} };
const click = async (selector) => edge.send('Runtime.evaluate', {
  expression: `document.querySelector(${JSON.stringify(selector)})?.click()`, userGesture: true,
});
const snapshot = () => edge.evaluate(`(() => {
  const shell = document.querySelector('[data-pond-shell]');
  const trace = window.__p11J?.snapshot();
  return { path: location.pathname, stage: shell?.dataset.pondStage,
    score: document.querySelector('main[data-score-state]')?.dataset.playbackState,
    echo: document.querySelector('[data-featured-echo-player]')?.dataset.featuredEchoPlayer,
    core: shell?.dataset.pondMountId, resources: trace?.resources,
    surfaces: trace?.surfaces, scrollY };
})()`);
let harness;
try {
  await edge.send('Page.addScriptToEvaluateOnNewDocument', { source: AUTH_SOURCE + ';\n' + PROBE_SOURCE });
  harness = await createRequestHarness(edge);
  await edge.load('/me/test', `Boolean(document.querySelector('.me-pond__controls'))`);
  result.checks.archiveTest = await edge.evaluate(`(() => {
    const node = document.querySelector('.me-pond__controls');
    return { controlsVisible: Boolean(node?.getClientRects().length),
      archiveInstances: document.querySelectorAll('.me-archive').length };
  })()`);
  if (!result.checks.archiveTest.controlsVisible || result.checks.archiveTest.archiveInstances !== 1) {
    throw new Error('调参页必须显示控制器且只有一个档案实例');
  }
  await click('.me-pond__controls button');
  result.checks.veilToggle = await edge.evaluate(`document.querySelector('.me-pond__veil').style.opacity`);
  if (result.checks.veilToggle !== '0.75') throw new Error('遮罩控制未生效');
  await edge.load('/me', `Boolean(document.querySelector('[data-score-origin-key="score-j-score-1"] a'))`);
  await click('[data-score-origin-key="score-j-score-1"] a');
  await edge.until(`location.pathname==='/score/1' && Boolean(document.querySelector('main[data-score-state="ready"]'))`, 'Score ready', 45000);
  await edge.until(`document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'`, 'Score stable');
  result.checks.scoreEntry = await snapshot();
  await click('.score-pond-header__back');
  await edge.until(`location.pathname==='/me' && document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'`, '返回档案');
  result.checks.returnArchive = await snapshot();
  await click('[data-score-origin-key="score-j-score-1"] a');
  await edge.until(`location.pathname==='/score/1' && Boolean(document.querySelector('main[data-score-state="ready"]'))`, 'Score 二次进入');
  await click('.score-pond-header__home');
  await edge.until(`location.pathname==='/' && document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'`, '返回首页');
  result.checks.returnHome = await snapshot();
  try {
    await edge.until(`Boolean(document.querySelector('[data-featured-echo-hit]'))`, 'ECHO 入口', 25000);
    await click('[data-featured-echo-hit]');
    await edge.until(`document.querySelector('[data-featured-echo-player]')?.dataset.featuredEchoPlayer==='playing'`, 'ECHO playing', 45000);
    result.checks.echoStarted = await snapshot();
    await click('.pond-home-surface a[href="/me"]');
    await edge.until(`location.pathname==='/me' && document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'`, 'ECHO 播放中进入档案');
    await click('[data-score-origin-key="score-j-score-1"] a');
    await edge.until(`location.pathname==='/score/1' && Boolean(document.querySelector('main[data-score-state="ready"]'))`, 'ECHO 播放中进入 Score', 45000);
    await click('.record-anchor__visual');
    await edge.until(`document.querySelector('main[data-score-state]')?.dataset.playbackState==='playing'`, 'Score playing', 45000);
    await wait(250);
    result.checks.concurrentPlayback = await snapshot();
    if (result.checks.concurrentPlayback.echo === 'playing') throw new Error('ECHO 未交出播放权');
  } catch (error) {
    result.checks.echoLimitation = { message: error.message, state: await snapshot() };
  }
} catch (error) { result.fatal = error.message; }
finally {
  result.writes = harness?.state.writes ?? [];
  result.errors = edge.errors;
  await writeEvidence('reviews/evidence/p11-closeout-review/fixes-browser.json', result);
  console.log(JSON.stringify(result, null, 2));
  edge.close();
}
