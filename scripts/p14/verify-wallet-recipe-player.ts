import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WalletRecipePlayerEngine } from '../../src/features/wallet-recipe/player/engine';
import { sharedPermanentMediaHealth } from '../../src/features/permanent-media/health';
import {
  createWalletRecipeTimeline,
  equalPowerGain,
  segmentAtPosition,
} from '../../src/features/wallet-recipe/player/timeline';
import type { WalletRecipePlayerInput } from '../../src/features/wallet-recipe/player/types';

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TX_ID = 'a'.repeat(43);
const AUDIO_BYTES = new TextEncoder().encode('p14-player-audio-fixture');
const AUDIO_SHA = createHash('sha256').update(AUDIO_BYTES).digest('hex');

function audioResponse(bytes: Uint8Array = AUDIO_BYTES): Response {
  return new Response(bytes.slice(), {
    headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes' },
  });
}

function makeInput(recipe: string): WalletRecipePlayerInput {
  const clips: WalletRecipePlayerInput['clips'] = {};
  for (const key of new Set(recipe)) {
    clips[key] = { uri: `ar://${TX_ID}`, sha256: AUDIO_SHA, durationMs: 1000 };
  }
  return { recipe, clips };
}

class FakeAudioParam {
  cancelScheduledValues(): void {}
  setValueAtTime(): void {}
  setValueCurveAtTime(): void {}
}

class FakeGain {
  gain = new FakeAudioParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeSource {
  buffer: AudioBuffer | null = null;
  stopped = false;
  startArgs: number[] = [];
  private ended: (() => void) | null = null;
  connect(): void {}
  disconnect(): void {}
  addEventListener(_name: string, listener: () => void): void { this.ended = listener; }
  start(...args: number[]): void { this.startArgs = args; }
  stop(): void { this.stopped = true; }
  finish(): void { this.ended?.(); }
}

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  sources: FakeSource[] = [];
  constructor(private readonly decodedDuration = 1) {}
  async resume(): Promise<void> { this.state = 'running'; }
  async close(): Promise<void> { this.state = 'closed'; }
  async decodeAudioData(): Promise<AudioBuffer> {
    return { duration: this.decodedDuration } as AudioBuffer;
  }
  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
  createGain(): GainNode { return new FakeGain() as unknown as GainNode; }
}

class FakeFrames {
  private nextId = 0;
  private callbacks = new Map<number, FrameRequestCallback>();
  request = (callback: FrameRequestCallback): number => {
    const id = ++this.nextId;
    this.callbacks.set(id, callback);
    return id;
  };
  cancel = (id: number): void => { this.callbacks.delete(id); };
  run(): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(0));
  }
  get count(): number { return this.callbacks.size; }
}

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

  await engine.play();
  assert.equal(contextCount, 1, '只有用户调用 play 才创建 AudioContext');
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
  await Promise.all([fallbackEngine.destroy(), failingEngine.destroy(), corruptEngine.destroy(), durationEngine.destroy()]);
}

async function main(): Promise<void> {
  verifyTimelines();
  await verifyEngineLifecycle();
  await verifyRecoverableErrors();
  console.log('P14-E1 时间线、等功率衔接、状态机与资源清理验证通过');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
