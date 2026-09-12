import { createHash } from 'node:crypto';
import type { WalletRecipePlayerInput } from '../../src/features/wallet-recipe/player/types';

export const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TX_ID = 'a'.repeat(43);
const AUDIO_BYTES = new TextEncoder().encode('p14-player-audio-fixture');
const AUDIO_SHA = createHash('sha256').update(AUDIO_BYTES).digest('hex');

export function audioResponse(bytes: Uint8Array = AUDIO_BYTES): Response {
  return new Response(bytes.slice(), {
    headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes' },
  });
}

export function makeInput(recipe: string): WalletRecipePlayerInput {
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

export class FakeSource {
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

export class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'suspended';
  destination = {} as AudioDestinationNode;
  sources: FakeSource[] = [];
  resumeCount = 0;
  decodeCount = 0;
  constructor(private readonly decodedDuration = 1,
    private readonly decodeBarrier?: { after: number; promise: Promise<void> }) {}
  async resume(): Promise<void> {
    this.resumeCount += 1;
    this.state = 'running';
  }
  async close(): Promise<void> { this.state = 'closed'; }
  async decodeAudioData(): Promise<AudioBuffer> {
    this.decodeCount += 1;
    if (this.decodeBarrier && this.decodeCount > this.decodeBarrier.after) {
      await this.decodeBarrier.promise;
    }
    return { duration: this.decodedDuration } as AudioBuffer;
  }
  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
  createGain(): GainNode { return new FakeGain() as unknown as GainNode; }
}

export class FakeFrames {
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

export function deferred(): { promise: Promise<void>; release: () => void } {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

export async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('等待播放器异步状态超时');
}
