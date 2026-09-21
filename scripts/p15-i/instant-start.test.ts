import assert from 'node:assert/strict';
import { ScorePlaybackEngine } from '../../src/features/score-playback/engine';
import { loadScoreResources, startupSoundKeys } from '../../src/features/score-playback/resource-loader';
import type { ScoreAudioIdentity, ScorePlaybackBootstrap } from '../../src/features/score-playback/types';

const encoder = new TextEncoder();
const tx = (value: string) => value.repeat(43);

async function identity(key: string, body: string): Promise<ScoreAudioIdentity> {
  const bytes = encoder.encode(body);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
  return { ref: `ar://${tx(key)}`, sha256, bytes: bytes.byteLength,
    mime: 'audio/mpeg', integrity: 'canonical' };
}

async function fixture(): Promise<{ bootstrap: ScorePlaybackBootstrap; bodies: Map<string, string> }> {
  const base = await identity('B', 'base');
  const early = await identity('A', 'early');
  const late = await identity('Z', 'late');
  return {
    bootstrap: {
      schema: 'ripples.score-bootstrap.v1', permanentDecoderUrl: 'https://decoder.test',
      eventsRef: `ar://${tx('E')}`, baseAudioRef: base.ref, soundsMapRef: `ar://${tx('S')}`,
      events: [
        { key: 'a', time: 0, duration: 100 },
        { key: 'a', time: 8_000, duration: 100 },
        { key: 'z', time: 8_001, duration: 100 },
      ],
      base, sounds: { a: early, z: late },
    },
    bodies: new Map([[tx('B'), 'base'], [tx('A'), 'early'], [tx('Z'), 'late']]),
  };
}

function response(body: string): Response {
  return new Response(body, { headers: {
    'content-type': 'audio/mpeg', 'content-length': String(encoder.encode(body).byteLength),
  } });
}

async function verifyStartupClosure(): Promise<void> {
  const { bootstrap, bodies } = await fixture();
  assert.deepEqual(startupSoundKeys(bootstrap.events), ['a']);
  let resolveLate!: (value: Response) => void;
  const lateResponse = new Promise<Response>((resolve) => { resolveLate = resolve; });
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const id = String(input).split('/').at(-1) ?? '';
    calls.push(id);
    if (id === tx('Z')) return lateResponse;
    const body = bodies.get(id);
    return body ? response(body) : new Response(null, { status: 404 });
  };
  const previous = process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
  process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = 'https://mirror.test';
  try {
    const resources = await loadScoreResources(bootstrap, fetcher, new AbortController().signal);
    assert.deepEqual(Object.keys(resources.soundBytes), ['a']);
    assert.equal(calls.at(-1), tx('Z'), '后台音效只能在启动闭包完成后开始');
    resolveLate(response('late'));
    assert.deepEqual(Object.keys(await resources.backgroundSoundBytes!), ['z']);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
    else process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = previous;
  }
}

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
  async decodeAudioData() { return { duration: 1 } as AudioBuffer; }
  createBufferSource() {
    return { buffer: null, connect() {}, addEventListener() {}, start() {}, stop() {} };
  }
}

class FakeBaseStream {
  primeCalls = 0;
  startCalls = 0;
  private primed = false;
  prime() { if (!this.primed) { this.primed = true; this.primeCalls += 1; } }
  async start() { this.startCalls += 1; }
  pause() {}
  positionMs() { return 0; }
  durationMs() { return 1_000; }
  destroy() {}
}

async function verifyQueuedIntent(): Promise<void> {
  const { bootstrap, bodies } = await fixture();
  let releaseStartup!: () => void;
  const startupGate = new Promise<void>((resolve) => { releaseStartup = resolve; });
  const fetcher: typeof fetch = async (input) => {
    const id = String(input).split('/').at(-1) ?? '';
    if (id === tx('B') || id === tx('A')) await startupGate;
    const body = bodies.get(id);
    return body ? response(body) : new Response(null, { status: 404 });
  };
  const previousMirror = process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = 'https://mirror.test';
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => undefined;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} },
  });
  let contexts = 0;
  const stream = new FakeBaseStream();
  const engine = new ScorePlaybackEngine({
    fetcher, createAudioContext: () => {
      contexts += 1; return new FakeAudioContext() as unknown as AudioContext;
    },
    createBaseStream: () => stream,
  });
  try {
    const loading = engine.load(bootstrap);
    assert.equal(stream.primeCalls, 1, '页面加载只静音预热一次');
    assert.equal(stream.startCalls, 0, '预热不得在用户手势前出声');
    await engine.play();
    assert.equal(engine.getSnapshot().playRequested, true);
    assert.equal(contexts, 1, 'AudioContext 应在首次用户手势中创建一次');
    assert.equal(stream.primeCalls, 1, '用户手势应复用既有预热');
    releaseStartup();
    await loading;
    assert.equal(engine.getSnapshot().state, 'playing');
    assert.equal(engine.getSnapshot().playRequested, false);
    assert.equal(stream.startCalls, 1);
  } finally {
    await engine.destroy();
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancel;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
    if (previousMirror === undefined) delete process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
    else process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = previousMirror;
  }
}

async function main(): Promise<void> {
  await verifyStartupClosure();
  await verifyQueuedIntent();
  console.log('P15-I 启动闭包与排队播放测试通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
