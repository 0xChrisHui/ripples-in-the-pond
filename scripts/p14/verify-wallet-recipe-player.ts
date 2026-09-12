import assert from 'node:assert/strict';
import { WalletRecipePlayerEngine } from '../../src/features/wallet-recipe/player/engine';
import { sharedPermanentMediaHealth } from '../../src/features/permanent-media/health';
import {
  createWalletRecipeTimeline,
  equalPowerGain,
  segmentAtPosition,
} from '../../src/features/wallet-recipe/player/timeline';
import {
  audioResponse,
  deferred,
  FakeAudioContext,
  FakeFrames,
  KEYS,
  makeInput,
  waitUntil,
} from './player-test-fixtures';
function verifyTimelines(): void {
  const repeated = createWalletRecipeTimeline(makeInput('A'.repeat(36)));
  assert.equal(repeated.uniqueKeys.length, 1);
  assert.equal(repeated.durationMs, 33_900);
  assert.equal(segmentAtPosition(repeated, 939)?.index, 0);
  assert.equal(segmentAtPosition(repeated, 940)?.index, 1);
  const headTail = createWalletRecipeTimeline(makeInput(`A${'B'.repeat(34)}A`));
  assert.deepEqual(headTail.uniqueKeys, ['A', 'B']);
  const allUnique = createWalletRecipeTimeline(makeInput(KEYS));
  assert.equal(allUnique.uniqueKeys.length, 36);
  const outgoing = repeated.segments[0];
  const incoming = repeated.segments[1];
  const outgoingGain = equalPowerGain(outgoing, 970);
  const incomingGain = equalPowerGain(incoming, 30);
  assert.ok(Math.abs(outgoingGain ** 2 + incomingGain ** 2 - 1) < 1e-12);
  assert.throws(() => createWalletRecipeTimeline(makeInput('A'.repeat(35))), /36 位/);
}

async function verifyEngineLifecycle(): Promise<void> {
  let fetchCount = 0;
  const fetcher: typeof fetch = async () => {
    fetchCount += 1;
    return audioResponse();
  };
  const frames = new FakeFrames();
  const context = new FakeAudioContext();
  let contextCount = 0;
  const engine = new WalletRecipePlayerEngine({
    fetcher,
    createAudioContext: () => {
      contextCount += 1;
      return context as unknown as AudioContext;
    },
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
  });
  const input = makeInput('A'.repeat(36));
  await engine.load(input);
  assert.equal(engine.getSnapshot().state, 'ready');
  assert.equal(fetchCount, 1, '重复字符只能下载一次');
  assert.equal(contextCount, 0, 'load 不得创建 AudioContext');
  const playing = engine.play();
  assert.equal(contextCount, 1, '只有用户调用 play 才创建 AudioContext');
  assert.equal(context.resumeCount, 1, 'AudioContext 必须在用户激活任务内恢复');
  await playing;
  assert.equal(context.sources.length, 36);
  assert.equal(frames.count, 1);
  context.currentTime = 0.56;
  frames.run();
  engine.pause();
  assert.equal(engine.getSnapshot().state, 'paused');
  assert.equal(engine.getSnapshot().positionMs, 500);
  assert.ok(context.sources.every((source) => source.stopped));
  assert.equal(frames.count, 0);
  await engine.resume();
  assert.equal(engine.getSnapshot().state, 'playing');
  for (let index = 0; index < 20; index += 1) await engine.replay();
  assert.equal(contextCount, 1, 'replay 不得创建第二个 AudioContext');
  assert.equal(frames.count, 1, '快速 replay 后只能留下一个时钟');

  let endedCount = 0;
  engine.subscribe(() => {
    if (engine.getSnapshot().state === 'ended') endedCount += 1;
  });
  context.currentTime += 34;
  frames.run();
  assert.equal(engine.getSnapshot().state, 'ended');
  assert.equal(endedCount, 1);
  assert.equal(frames.count, 0);

  await engine.destroy();
  assert.equal(engine.getSnapshot().state, 'idle');
  assert.equal(context.state, 'closed');
}

async function verifyProgressiveScheduling(): Promise<void> {
  const firstRemaining = deferred();
  const laterRemaining = deferred();
  const decodeBarrier = deferred();
  let fetchCount = 0;
  const fetcher: typeof fetch = async () => {
    fetchCount += 1;
    if (fetchCount >= 5 && fetchCount <= 8) await firstRemaining.promise;
    if (fetchCount >= 9) await laterRemaining.promise;
    return audioResponse();
  };
  const frames = new FakeFrames();
  const context = new FakeAudioContext(1, { after: 8, promise: decodeBarrier.promise });
  const engine = new WalletRecipePlayerEngine({
    fetcher,
    createAudioContext: () => context as unknown as AudioContext,
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
  });
  await engine.load(makeInput(KEYS));
  await engine.play();
  assert.equal(context.sources.length, 4, '首屏只调度前四个 key');
  context.currentTime = 0.5;
  firstRemaining.release();
  await waitUntil(() => context.sources.length >= 8);
  assert.equal(fetchCount, 12, 'remaining 必须保持四 key 有界批次');
  assert.equal(engine.getSnapshot().loadedUniqueCount, 8, '首个 remaining 批次应立即合并');
  assert.ok(Math.abs(context.sources[4].startArgs[0] - 3.84) < 0.001,
    '晚到 buffer 必须以当前 AudioContext 时间和 playhead 调度');
  laterRemaining.release();
  await waitUntil(() => context.decodeCount >= 12);
  engine.pause();
  await engine.resume();
  assert.equal(engine.getSnapshot().state, 'playing', '续播不得等待后台剩余片段解码');
  decodeBarrier.release();
  await waitUntil(() => context.decodeCount === KEYS.length);
  assert.equal(context.sources.filter((source) => !source.stopped).length, KEYS.length);
  await engine.destroy();
}

async function verifyRecoverableErrors(): Promise<void> {
  const frames = new FakeFrames();
  let attempts = 0;
  const fallbackEngine = new WalletRecipePlayerEngine({
    fetcher: async () => {
      attempts += 1;
      return attempts === 1 ? new Response(null, { status: 503 }) : audioResponse();
    },
    createAudioContext: () => new FakeAudioContext() as unknown as AudioContext,
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
  });
  await fallbackEngine.load(makeInput('A'.repeat(36)));
  assert.equal(fallbackEngine.getSnapshot().state, 'ready', '备用网关应恢复加载');
  assert.equal(attempts, 2);

  const failingEngine = new WalletRecipePlayerEngine({
    fetcher: async () => new Response(null, { status: 503 }),
  });
  await failingEngine.load(makeInput('A'.repeat(36)));
  assert.equal(failingEngine.getSnapshot().errorKind, 'network');
  sharedPermanentMediaHealth.reset();

  const corruptEngine = new WalletRecipePlayerEngine({
    fetcher: async () => audioResponse(new TextEncoder().encode('corrupt')),
  });
  await corruptEngine.load(makeInput('A'.repeat(36)));
  assert.equal(corruptEngine.getSnapshot().errorKind, 'integrity');

  let invalidFetches = 0;
  const invalidInput = makeInput('A'.repeat(36));
  invalidInput.clips.A.sha256 = 'ABC';
  const invalidEngine = new WalletRecipePlayerEngine({ fetcher: async () => {
    invalidFetches += 1;
    return audioResponse();
  } });
  await invalidEngine.load(invalidInput);
  assert.equal(invalidEngine.getSnapshot().errorKind, 'invalid_input');
  assert.equal(invalidFetches, 0, '非法 hash 不得进入 resolver');

  const durationEngine = new WalletRecipePlayerEngine({
    fetcher: async () => audioResponse(),
    createAudioContext: () => new FakeAudioContext(0.5) as unknown as AudioContext,
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
  });
  await durationEngine.load(makeInput('A'.repeat(36)));
  await durationEngine.play();
  assert.equal(durationEngine.getSnapshot().errorKind, 'integrity');

  await durationEngine.load(makeInput('B'.repeat(36)));
  assert.equal(durationEngine.getSnapshot().state, 'ready', '错误后重新 load 应恢复');
  await Promise.all([fallbackEngine.destroy(), failingEngine.destroy(), corruptEngine.destroy(),
    invalidEngine.destroy(), durationEngine.destroy()]);
}

async function main(): Promise<void> {
  verifyTimelines();
  await verifyEngineLifecycle();
  await verifyProgressiveScheduling();
  await verifyRecoverableErrors();
  console.log('P14-E1 时间线、渐进调度、状态机与资源清理验证通过');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
