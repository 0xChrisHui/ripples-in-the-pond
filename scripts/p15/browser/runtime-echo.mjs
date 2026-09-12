function nearestRank(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

const uiExpression = `(() => { const root=document.querySelector('.echo-player');
  const action=document.querySelector('.echo-player__action'); return { state:root?.dataset.state??null,
    status:document.querySelector('.echo-player__status')?.textContent?.trim()??null,
    action:action?.textContent?.trim()??null, actionDisabled:action?Boolean(action.disabled):null }; })()`;

async function clickPlay(cdp) {
  const point = await cdp.evaluate(`(() => { const node=document.querySelector('.echo-player__action');
    node.scrollIntoView({block:'center'});const box=node.getBoundingClientRect();
    return {x:box.x+box.width/2,y:box.y+box.height/2};})()`);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', ...point, button: 'left', clickCount: 1,
  });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', ...point, button: 'left', clickCount: 1,
  });
}

async function readPlayback(cdp) {
  return cdp.evaluate(`(() => { const mark=(name)=>performance.getEntriesByName(name).at(-1)?.startTime??null;
    const intent=mark('p15:recipe-audio-intent'),scheduled=mark('p15:recipe-first-sound-scheduled');
    return {state:document.querySelector('.echo-player')?.dataset.state??null,intentAt:intent,scheduledAt:scheduled,
      intentToScheduledMs:intent==null||scheduled==null?null:scheduled-intent,
      expectedFirstSoundMs:intent==null||scheduled==null?null:scheduled-intent+60,
      expectedBasis:'排程 mark 加播放器 60ms 初始 anchor',actualAudibilityVerified:false};})()`);
}

async function sampleEcho(cdp, navigate, waitFor, classification, index) {
  const starts = { console: cdp.consoleErrors.length, page: cdp.pageErrors.length };
  try {
    await navigate(cdp, '/echo/1');
    await waitFor(cdp, `['ready','error'].includes(
      document.querySelector('.echo-player')?.dataset.state)`, 30_000, `Pond Echo ${classification} ready`);
    const ui = await cdp.evaluate(uiExpression);
    if (ui.state === 'ready') {
      await clickPlay(cdp);
      await waitFor(cdp, `performance.getEntriesByName('p15:recipe-first-sound-scheduled').length>0
        || document.querySelector('.echo-player')?.dataset.state==='error'`,
      30_000, `Pond Echo ${classification} 预计首声排程`);
    }
    return { classification, index, ui, playback: await readPlayback(cdp),
      consoleErrors: cdp.consoleErrors.slice(starts.console),
      pageErrors: cdp.pageErrors.slice(starts.page) };
  } catch (error) {
    const ui = await cdp.evaluate(uiExpression).catch(() => null);
    return { classification, index, error: error instanceof Error ? error.message : String(error), ui,
      playback: await readPlayback(cdp).catch(() => null),
      consoleErrors: cdp.consoleErrors.slice(starts.console),
      pageErrors: cdp.pageErrors.slice(starts.page) };
  }
}

async function measureContinuity(cdp, navigate, waitFor) {
  const starts = { console: cdp.consoleErrors.length, page: cdp.pageErrors.length };
  const snapshot = `(() => { const active=document.querySelector('.echo-recipe li[aria-current="step"]');
    const currentIndex=active?[...active.parentElement.children].indexOf(active):null;
    return {state:document.querySelector('.echo-player')?.dataset.state??null,currentIndex,
      currentSegment:currentIndex==null?null:currentIndex+1,
      allResourcesReady:performance.getEntriesByName('p15:recipe-all-resources-ready').length>0,
      crossedFourToFive:currentIndex!=null&&currentIndex>=4,actualAudibilityVerified:false};})()`;
  try {
    await navigate(cdp, '/echo/1');
    await waitFor(cdp, `['ready','error'].includes(
      document.querySelector('.echo-player')?.dataset.state)`, 30_000, 'Pond Echo continuity ready');
    const ready = await cdp.evaluate(uiExpression);
    if (ready.state !== 'ready') throw new Error(`continuity 播放器状态为 ${ready.state}`);
    await clickPlay(cdp);
    await waitFor(cdp, `(() => { const active=document.querySelector(
      '.echo-recipe li[aria-current="step"]'); const index=active?[...active.parentElement.children].indexOf(active):null;
      const state=document.querySelector('.echo-player')?.dataset.state;
      return state==='error'||(state==='playing'&&index>=4
        &&performance.getEntriesByName('p15:recipe-all-resources-ready').length>0); })()`,
    30_000, 'Pond Echo continuity 跨 4→5 段');
    return { ...(await cdp.evaluate(snapshot)), consoleErrors: cdp.consoleErrors.slice(starts.console),
      pageErrors: cdp.pageErrors.slice(starts.page) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error),
      ...(await cdp.evaluate(snapshot).catch(() => ({ actualAudibilityVerified: false }))),
      consoleErrors: cdp.consoleErrors.slice(starts.console),
      pageErrors: cdp.pageErrors.slice(starts.page) };
  }
}

function summarize(samples) {
  const values = samples.map((sample) => sample.playback?.expectedFirstSoundMs)
    .filter(Number.isFinite);
  return { requested: 10, valid: values.length, p95Method: 'nearest-rank',
    p95ExpectedFirstSoundMs: nearestRank(values, .95), samples };
}

export async function measureEchoRuntime({ cdp, siteBase, navigate, waitFor }) {
  const origin = new URL(siteBase).origin;
  const coldSamples = [];
  for (let index = 1; index <= 10; index += 1) {
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'cache_storage' });
    coldSamples.push(await sampleEcho(cdp, navigate, waitFor, 'cold', index));
  }
  const hotSamples = [];
  for (let index = 1; index <= 10; index += 1) {
    hotSamples.push(await sampleEcho(cdp, navigate, waitFor, 'hot', index));
  }
  const continuity = await measureContinuity(cdp, navigate, waitFor);
  return {
    cacheBoundary: {
      cold: '10 个 cold 样本各自在导航前清除浏览器 HTTP cache 与本站 Cache Storage；保留 cookies',
      hot: '第 10 个 cold 完成后，同一 CDP target 连续 10 次完整导航，不再清缓存',
      continuity: '10 个 hot 后再导航一次且不清缓存，观察播放跨过第 4→5 段',
      scope: '仅证明浏览器侧冷/热边界；未清除 Preview、CDN 或服务端缓存',
    },
    actualAudibilityVerified: false,
    cold: summarize(coldSamples),
    hot: summarize(hotSamples),
    continuity,
  };
}
