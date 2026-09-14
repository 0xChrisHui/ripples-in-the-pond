import assert from 'node:assert/strict';
import {
  PermanentMediaHealth,
  PermanentMediaMirrorProbe,
  resolvePermanentMedia,
} from '../../../src/features/permanent-media';
const REF = `ar://${'A'.repeat(43)}`;
const REF_TWO = `ar://${'B'.repeat(43)}`;
const MIRROR = 'https://mirror.example/media';
const STORAGE_KEY = 'ripples:media-mirror-health:v1';
class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}
function probeResponse(status = 206, headers: HeadersInit = {}): Response {
  return new Response(new Uint8Array([7]), {
    status,
    headers: {
      'content-range': 'bytes 0-0/42',
      'content-length': '1',
      'content-type': 'audio/mpeg',
      ...Object.fromEntries(new Headers(headers)),
    },
  });
}
function request(fetcher: typeof fetch, signal?: AbortSignal) {
  return { fetcher, signal, mirrorBaseUrl: MIRROR };
}
async function verifyStrictContract(): Promise<void> {
  const validCalls: Array<{ url: string; init?: RequestInit }> = [];
  const valid: typeof fetch = async (input, init) => {
    validCalls.push({ url: String(input), init });
    return probeResponse();
  };
  const gate = new PermanentMediaMirrorProbe({ storage: null });
  assert.equal(await gate.select(REF, request(valid)), MIRROR);
  assert.equal(validCalls[0].url, `${MIRROR}/${'A'.repeat(43)}`);
  assert.equal(new Headers(validCalls[0].init?.headers).get('range'), 'bytes=0-0');
  assert.equal(validCalls[0].init?.cache, 'no-store');
  const hiddenRange = new Response(new Uint8Array([7]), {
    status: 206, headers: { 'content-length': '1', 'content-type': 'audio/mpeg' },
  });
  assert.equal(await new PermanentMediaMirrorProbe({ storage: null })
    .select(REF, request(async () => hiddenRange)), MIRROR,
  'Vercel Blob 未暴露 Content-Range 时仍须用 206、长度与实际字节准入');
  const invalid: Array<[string, Response]> = [
    ['200', probeResponse(200)],
    ['坏 Range', probeResponse(206, { 'content-range': 'bytes 1-1/42' })],
    ['坏长度', probeResponse(206, { 'content-length': '2' })],
    ['坏类型', probeResponse(206, { 'content-type': 'text/html' })],
    ['404', new Response(null, { status: 404 })],
  ];
  for (const [label, result] of invalid) {
    const isolated = new PermanentMediaMirrorProbe({ storage: null });
    assert.equal(await isolated.select(REF, request(async () => result)), '', label);
  }
  let objectCalls = 0;
  const objectGate = new PermanentMediaMirrorProbe({ storage: null });
  assert.equal(await objectGate.select(REF, request(async () => {
    objectCalls += 1; return new Response(null, { status: 404 });
  })), '');
  assert.equal(await objectGate.select(REF_TWO, request(async () => {
    objectCalls += 1; return probeResponse();
  })), MIRROR);
  assert.equal(objectCalls, 2, '单对象 404 不得熔断整个 origin');
}
async function verifyBackoffAndRecovery(): Promise<void> {
  let now = 1_000;
  let calls = 0;
  const storage = new MemoryStorage();
  const down: typeof fetch = async () => { calls += 1; return new Response(null, { status: 503 }); };
  const first = new PermanentMediaMirrorProbe({ storage, now: () => now, cooldownsMs: [300] });
  assert.equal(await first.select(REF, request(down)), '');
  assert.equal(calls, 1);
  const saved = storage.getItem(STORAGE_KEY) ?? '';
  assert.ok(saved.includes('https://mirror.example'));
  assert.ok(!saved.includes('A'.repeat(43)), '持久状态不得包含 txid');
  const refreshed = new PermanentMediaMirrorProbe({ storage, now: () => now, cooldownsMs: [300] });
  assert.equal(await refreshed.select(REF, request(down)), '');
  assert.equal(calls, 1, '跨刷新冷却期必须零探针');
  now += 301;
  assert.equal(await refreshed.select(REF, request(async () => { calls += 1; return probeResponse(); })), MIRROR);
  assert.equal(calls, 2);
  assert.ok(storage.getItem(STORAGE_KEY), 'half-open 探针成功前不能冒充完整对象恢复');
  refreshed.recordServiceSuccess(MIRROR);
  assert.equal(storage.getItem(STORAGE_KEY), null, '完整对象成功必须清除失败状态');
  let volatileCalls = 0;
  const stale = JSON.stringify({ schema: 1, entries: { 'https://mirror.example':
    { level: 0, nextProbeAt: 0 } } });
  const denied = { getItem: () => stale, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined };
  const volatile = new PermanentMediaMirrorProbe({ storage: denied, now: () => now, cooldownsMs: [300] });
  const unavailable: typeof fetch = async () => { volatileCalls += 1; return new Response(null, { status: 503 }); };
  await volatile.select(REF, request(unavailable)); await volatile.select(REF, request(unavailable));
  assert.equal(volatileCalls, 1, '持久写失败后必须保留内存熔断');
  storage.setItem(STORAGE_KEY, '{"schema":0,"entries":{"secret":"bad"}}');
  const migrated = new PermanentMediaMirrorProbe({ storage, now: () => now });
  assert.equal(await migrated.select(REF, request(async () => probeResponse())), MIRROR);
  assert.equal(storage.getItem(STORAGE_KEY), null, '旧 schema 必须按空状态安全恢复');
}
async function verifySingleFlight(): Promise<void> {
  let calls = 0;
  let release!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => { release = resolve; });
  const fetcher: typeof fetch = async () => { calls += 1; return pending; };
  const gate = new PermanentMediaMirrorProbe({ storage: null });
  const first = gate.select(REF, request(fetcher));
  const second = gate.select(REF_TWO, request(fetcher));
  await Promise.resolve();
  assert.equal(calls, 1, '同 origin 只能存在一个探针');
  release(probeResponse());
  assert.deepEqual(await Promise.all([first, second]), [MIRROR, MIRROR]);

  let sharedCalls = 0;
  let finish!: (response: Response) => void;
  const sharedPending = new Promise<Response>((resolve) => { finish = resolve; });
  const sharedFetcher: typeof fetch = async () => { sharedCalls += 1; return sharedPending; };
  const sharedGate = new PermanentMediaMirrorProbe({ storage: null });
  const leaving = new AbortController();
  const abandoned = sharedGate.select(REF, request(sharedFetcher, leaving.signal));
  const remaining = sharedGate.select(REF_TWO, request(sharedFetcher));
  leaving.abort();
  await assert.rejects(abandoned, /取消|aborted/i);
  finish(probeResponse());
  assert.equal(await remaining, MIRROR, '一个等待者离开不得取消其他等待者的共享探针');
  assert.equal(sharedCalls, 1);
}
async function verifyAbortAndTimeout(): Promise<void> {
  let fetchAborted = false;
  const hanging: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      fetchAborted = true;
      reject(new DOMException('已取消', 'AbortError'));
    }, { once: true });
  });
  const controller = new AbortController();
  const gate = new PermanentMediaMirrorProbe({ storage: null });
  const selection = gate.select(REF, request(hanging, controller.signal));
  controller.abort();
  await assert.rejects(selection, /取消|aborted/i);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchAborted, true, '最后一个等待者离开后必须 Abort 在途 fetch');
  assert.equal(await gate.select(REF_TWO, request(async () => probeResponse())), MIRROR,
    '取消后的新请求不得复用已 Abort 的 flight');

  const timeoutGate = new PermanentMediaMirrorProbe({ storage: null, timeoutMs: 5 });
  const started = performance.now();
  assert.equal(await timeoutGate.select(REF, request(hanging)), '');
  assert.ok(performance.now() - started < 100, '超时必须有界回退');
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function verifyCacheSkipsProbe(): Promise<void> {
  const stored = new Map<string, Response>();
  const cache = {
    match: async (key: RequestInfo | URL) => stored.get(String(key))?.clone(),
    put: async (key: RequestInfo | URL, value: Response) => { stored.set(String(key), value.clone()); },
    delete: async (key: RequestInfo | URL) => stored.delete(String(key)),
  } as unknown as Cache;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', {
    configurable: true, value: { open: async () => cache } as unknown as CacheStorage,
  });
  try {
    const bytes = new TextEncoder().encode('verified cache');
    const expected = await sha256(bytes);
    const source: typeof fetch = async () => new Response(bytes, {
      headers: { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' },
    });
    const base = { kind: 'audio', validation: { level: 'canonical', sha256: expected },
      rounds: 1, health: new PermanentMediaHealth() } as const;
    await resolvePermanentMedia(REF, { ...base, fetcher: source, mirrorBaseUrl: '' });
    let probes = 0;
    const result = await resolvePermanentMedia(REF, {
      ...base, fetcher: async () => { throw new Error('缓存命中后不得联网'); },
      mirrorBaseUrl: MIRROR,
      mirrorProbe: { select: async () => { probes += 1; return MIRROR; } },
    });
    assert.equal(result.source, 'cache');
    assert.equal(probes, 0, '可信缓存命中必须零探针');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor);
    else Reflect.deleteProperty(globalThis, 'caches');
  }
}

/** 覆盖镜像严格准入、服务退避、并发去重、取消和缓存旁路。 */
export async function verifyMirrorProbe(): Promise<void> {
  await verifyStrictContract();
  await verifyBackoffAndRecovery();
  await verifySingleFlight();
  await verifyAbortAndTimeout();
  await verifyCacheSkipsProbe();
}
