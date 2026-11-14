import assert from 'node:assert/strict';
import test from 'node:test';
import { WalletRecipePlayerEngine } from '../../src/features/wallet-recipe/player/engine';
import { audioResponse, FakeAudioContext, FakeFrames, makeInput, waitUntil } from '../p14/player-test-fixtures';

// 真正执行播放器与永久资源校验，仅用确定字节替换网络和浏览器音频设备。
function setup() {
  const calls: string[] = [], context = new FakeAudioContext(), frames = new FakeFrames();
  const resume = context.resume.bind(context);
  context.resume = () => { calls.push('resume'); return resume(); };
  const engine = new WalletRecipePlayerEngine({
    fetcher: async () => { calls.push('fetch'); return audioResponse(); },
    createAudioContext: () => context as unknown as AudioContext,
    requestFrame: frames.request, cancelFrame: frames.cancel,
  });
  return { engine, calls, context };
}
type LazyEngine = { load(input: ReturnType<typeof makeInput>, deferAudio?: boolean): Promise<void> };

test('Echo延迟模式不下载，首次点击先恢复AudioContext再取音频，恢复播放不重下', async () => {
  const h = setup();
  try {
    await (h.engine as LazyEngine).load(makeInput('A'.repeat(36)), true);
    assert.equal(h.engine.getSnapshot().state, 'ready');
    assert.deepEqual(h.calls, []);
    const playing = h.engine.play();
    assert.equal(h.calls[0], 'resume');
    await playing;
    assert.equal(h.engine.getSnapshot().state, 'playing');
    const downloads = h.calls.filter(c => c === 'fetch').length;
    assert.ok(downloads > 0);
    h.engine.pause(); await h.engine.resume();
    assert.equal(h.calls.filter(c => c === 'fetch').length, downloads);
  } finally { await h.engine.destroy(); }
});
test('默认load保持既有预载合同，延迟模式仍验证配方', async () => {
  const h = setup();
  try {
    await h.engine.load(makeInput('A'.repeat(36)));
    assert.ok(h.calls.includes('fetch')); assert.equal(h.engine.getSnapshot().state, 'ready');
    h.calls.length = 0;
    await (h.engine as LazyEngine).load(makeInput('INVALID'), true);
    assert.equal(h.engine.getSnapshot().state, 'error'); assert.equal(h.calls.length, 0);
  } finally { await h.engine.destroy(); }
});
test('延迟下载过程中卸载，不得继续进入播放或覆盖idle状态', async () => {
  let complete: (() => void) | undefined;
  const h = setup();
  const engine = new WalletRecipePlayerEngine({
    fetcher: async () => new Promise<Response>(resolve => { complete = () => resolve(audioResponse()); }),
    createAudioContext: () => h.context as unknown as AudioContext,
    requestFrame: () => 1, cancelFrame: () => {},
  });
  await (engine as LazyEngine).load(makeInput('A'.repeat(36)), true);
  const playing = engine.play(); await waitUntil(() => Boolean(complete));
  await engine.destroy(); complete!(); await playing;
  assert.equal(engine.getSnapshot().state, 'idle');
});

test('旧音频设备延迟关闭时，旧load不能覆盖新输入或复活已卸载状态', async () => {
  for (const destroy of [false, true]) {
    const h = setup(); let finishClose!: () => void;
    await h.engine.load(makeInput('C'.repeat(36))); await h.engine.play();
    h.context.close = () => new Promise<void>(resolve => { finishClose = resolve; });
    const old = (h.engine as LazyEngine).load(makeInput('A'.repeat(36)), true);
    if (destroy) await h.engine.destroy();
    else await (h.engine as LazyEngine).load(makeInput('B'.repeat(36)), true);
    finishClose(); await old;
    assert.equal(h.engine.getSnapshot().state, destroy ? 'idle' : 'ready');
    assert.equal(h.engine.getSnapshot().currentKey, destroy ? null : 'B');
    await h.engine.destroy();
  }
});
test('浏览器拒绝音频授权时立即报告错误，不启动无意义的音频下载', async () => {
  const h = setup();
  h.context.resume = async () => { throw new Error('音频授权被拒绝'); };
  try {
    await (h.engine as LazyEngine).load(makeInput('A'.repeat(36)), true);
    await h.engine.play();
    assert.equal(h.engine.getSnapshot().state, 'error');
    assert.equal(h.calls.includes('fetch'), false);
  } finally { await h.engine.destroy(); }
});
