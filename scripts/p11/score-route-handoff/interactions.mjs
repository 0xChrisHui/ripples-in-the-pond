import { wait } from '../../../reviews/evidence/p11-i/lib/edge-cdp.mjs';
import { addClockSamples } from './telemetry.mjs';

const row = (key) => `[data-score-origin-key="score-${key}"] a`;

async function click(edge, selector) {
  const clicked = await edge.evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)});
    if(!node)return false;node.click();return true})()`);
  if (!clicked) throw new Error(`最小 Gate 找不到入口：${selector}`);
}

async function stable(edge, path, owner, label) {
  await edge.until(`location.pathname===${JSON.stringify(path)}
    &&document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'
    &&document.querySelector('[data-pond-shell]')?.dataset.pondCurrent===${JSON.stringify(owner)}`,
  label, 45_000);
}

async function archive(edge) {
  await edge.load('/me', `Boolean(document.querySelector(${JSON.stringify(row('j-score-1'))}))`);
  await stable(edge, '/me', 'archive', '档案稳定');
}

async function score(edge, token = 1) {
  await stable(edge, `/score/${token}`, 'score', `Score ${token} 稳定`);
}

async function state(edge) {
  return edge.evaluate(`(() => { const shell=document.querySelector('[data-pond-shell]');
    const archive=document.querySelector('.me-archive');const value=window.__p11J.snapshot();
    return {path:location.pathname,stage:shell?.dataset.pondStage,current:shell?.dataset.pondCurrent,
      target:shell?.dataset.pondTarget,interactiveOwner:shell?.dataset.pondInteractiveOwner,
      busy:document.querySelector('[aria-busy="true"]')?.dataset.scoreOriginKey??null,
      originStage:archive?.dataset.scoreOriginStage??null,anchors:value.anchors,
      scoreToken:document.querySelector('[data-score-token-id]')?.dataset.scoreTokenId??null,
      resources:value.resources,players:value.players,playback:document.querySelector(
        'main[data-score-state]')?.dataset.playbackState??null};})()`);
}

async function browserBack(edge) {
  await archive(edge); await click(edge, row('j-score-1')); await score(edge);
  await edge.evaluate('history.back();true'); await stable(edge, '/me', 'archive', 'Back 返回档案');
  const final = await state(edge);
  return { final, passed: final.busy === null && final.originStage === null
    && final.interactiveOwner === 'archive' && final.anchors <= 1 };
}

async function rapidReverse(edge, harness) {
  harness.armCold('/score/2', 2_000); await archive(edge); harness.activateCold();
  await click(edge, row('j-score-2'));
  await edge.until(`document.querySelector('[data-pond-shell]')?.dataset.pondStage==='preparing'`,
    '快速反向进入 preparing');
  const reverseStage = await edge.evaluate(`document.querySelector('[data-pond-shell]')?.dataset.pondStage`);
  await edge.evaluate(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape'}));true`);
  await stable(edge, '/me', 'archive', 'Escape 取消后收敛');
  const deadline = Date.now() + 3_000;
  while (harness.state.cold?.releasedAt == null && Date.now() < deadline) await wait(25);
  const cold = await harness.disarmCold();
  await wait(700); const final = await state(edge);
  return { reverseStage, cold, final, passed: reverseStage === 'preparing'
    && cold?.releaseReason === 'controlled-delay' && final.busy === null
    && final.originStage === null && final.path === '/me' && final.anchors <= 1 };
}

async function switchTarget(edge, harness) {
  harness.armCold('/score/1', 2_000); await archive(edge); harness.activateCold();
  await click(edge, row('j-score-1'));
  await edge.until(`document.querySelector('[data-pond-shell]')?.dataset.pondStage==='preparing'`,
    '首目标 preparing');
  await click(edge, row('j-score-2')); await harness.abortCold('superseded-target'); await score(edge, 2);
  const target = await state(edge); await click(edge, '.score-pond-header__back');
  await stable(edge, '/me', 'archive', '换目标后返回档案'); const final = await state(edge);
  return { target, final, passed: target.path === '/score/2' && target.scoreToken === '2'
    && target.current === 'score' && final.busy === null && final.anchors <= 1 };
}

async function fallbackRecovery(edge) {
  await archive(edge); await click(edge, row('j-missing'));
  await edge.until(`location.pathname==='/score/99999999'
    &&Boolean(document.querySelector('main[data-score-state="failed"],main.score-fallback[data-score-state="fallback"]'))`,
  '公开缺失作品失败壳', 60_000);
  await stable(edge, '/score/99999999', 'score', '失败壳稳定');
  const fallback = await state(edge);
  const selector = await edge.evaluate(`document.querySelector('main.score-fallback')
    ?'.score-fallback a[href="/me"]':'.score-pond-header__back'`);
  await click(edge, selector);
  await stable(edge, '/me', 'archive', 'fallback 返回档案'); const final = await state(edge);
  return { fallback, final, passed: fallback.current === 'score' && final.busy === null
    && final.originStage === null && final.anchors <= 1 };
}

async function audioCleanup(edge) {
  await edge.load('/score/1', `Boolean(document.querySelector('main[data-score-state="ready"]'))`);
  await score(edge); await edge.until(`document.querySelector('main[data-score-state]')?.dataset.playbackState!=='loading'`,
    'Score 音频资源首轮就绪', 45_000);
  await edge.evaluate(`window.__p11J.begin('minimal-audio-leave','score','home')`);
  await click(edge, '.record-anchor__visual');
  await edge.until(`window.__p11J.snapshot().resources.audio>=1`, 'AudioContext 创建', 20_000);
  await wait(500); const active = await state(edge); await click(edge, '.score-pond-header__home');
  await stable(edge, '/', 'home', '播放后返回首页'); await wait(1_200);
  const final = await state(edge); const trace = addClockSamples(await edge.evaluate('window.__p11J.end()'));
  const doublePlayerFrames = trace.frames.filter((frame) => frame.resources.media > 1
    || (frame.players.score === 'playing' && (frame.players.global || frame.players.featured))).length;
  return { active, final, doublePlayerFrames, trace,
    passed: active.resources.audio >= 1 && final.resources.audio === 0
      && final.resources.sources === 0 && final.resources.media === 0
      && final.resources.scoreFetchUrls.length === 0 && doublePlayerFrames === 0 };
}

export async function runMinimalInteractions(edge, harness) {
  const result = {};
  result.browserBack = await browserBack(edge);
  result.rapidReverse = await rapidReverse(edge, harness);
  result.switchTarget = await switchTarget(edge, harness);
  result.fallbackRecovery = await fallbackRecovery(edge);
  result.audioCleanup = await audioCleanup(edge);
  result.passed = Object.values(result).filter((item) => typeof item === 'object')
    .every((item) => item.passed === true);
  return result;
}
