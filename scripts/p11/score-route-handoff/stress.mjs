import { wait } from '../../../reviews/evidence/p11-i/lib/edge-cdp.mjs';

const SCORE_ROW = '[data-score-origin-key="score-j-score-1"] a';

async function click(edge, selector, label) {
  const clicked = await edge.evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false; node.click(); return true; })()`);
  if (!clicked) throw new Error(`连续性循环找不到${label}：${selector}`);
}

async function stable(edge, path, owner, label) {
  await edge.until(`location.pathname===${JSON.stringify(path)}
    && document.querySelector('[data-pond-shell]')?.dataset.pondStage==='stable'
    && document.querySelector('[data-pond-shell]')?.dataset.pondCurrent===${JSON.stringify(owner)}
    && document.querySelector('[data-pond-shell]')?.dataset.pondSceneReady==='true'
    && document.querySelectorAll('canvas').length >= 2`,
  label, 30_000);
}

async function snapshot(edge) {
  return edge.evaluate(`(() => { const value=window.__p11J.snapshot(); return {
    path:value.path, coreId:value.coreId, mountId:value.mountId, canvasIds:value.canvasIds,
    contexts:value.contexts, framebuffers:value.framebuffers, anchors:value.anchors,
    interactiveOwner:value.interactiveOwner, sceneOwner:value.sceneOwner,
  }; })()`);
}

function identityStable(samples) {
  const first = samples[0];
  return samples.every((sample) => sample.coreId === first.coreId && sample.mountId === first.mountId
    && sample.canvasIds.join(',') === first.canvasIds.join(',') && sample.contexts === first.contexts
    && sample.framebuffers === first.framebuffers && sample.anchors <= 1);
}

async function homeToScoreToHome(edge) {
  const samples = [await snapshot(edge)];
  await click(edge, 'a[href^="/me"]', '首页档案入口'); await stable(edge, '/me', 'archive', '档案稳定');
  samples.push(await snapshot(edge));
  await click(edge, SCORE_ROW, '档案唱片'); await stable(edge, '/score/1', 'score', 'Score 稳定');
  samples.push(await snapshot(edge));
  await click(edge, '.score-pond-header__back', '返回档案'); await stable(edge, '/me', 'archive', '档案返回稳定');
  samples.push(await snapshot(edge));
  await click(edge, '.me-archive__back', '返回水塘'); await stable(edge, '/', 'home', '首页返回稳定');
  samples.push(await snapshot(edge));
  return { passed: identityStable(samples), samples };
}

async function scoreToHome(edge, direct) {
  if (direct) {
    await edge.load('/score/1', `Boolean(document.querySelector('main[data-score-state="ready"]'))`);
    await stable(edge, '/score/1', 'score', '直接 Score 稳定');
    // 首次直达需要等自适应 DPR 完成，避免把启动期 FBO 分配误算成路由增长。
    await wait(900);
  } else {
    await click(edge, 'a[href^="/me"]', '首页档案入口'); await stable(edge, '/me', 'archive', '档案稳定');
    await click(edge, SCORE_ROW, '档案唱片'); await stable(edge, '/score/1', 'score', 'Score 稳定');
  }
  const samples = [await snapshot(edge)];
  await click(edge, '.score-pond-header__home', 'Score 水塘入口'); await stable(edge, '/', 'home', 'Score 返回首页稳定');
  samples.push(await snapshot(edge));
  return { direct, passed: identityStable(samples), samples };
}

export async function runStress(edge, count = 20) {
  await edge.load('/', `Boolean(document.querySelector('[data-pond-shell]'))`);
  await stable(edge, '/', 'home', '循环首页稳定');
  const roundTrips = [];
  for (let index = 0; index < count; index++) roundTrips.push(await homeToScoreToHome(edge));
  const scoreHome = [];
  for (let index = 0; index < count; index++) scoreHome.push(await scoreToHome(edge, index % 2 === 0));
  return {
    count, roundTrips, scoreHome,
    passed: roundTrips.every((item) => item.passed) && scoreHome.every((item) => item.passed),
  };
}
