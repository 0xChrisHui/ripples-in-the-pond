import assert from 'node:assert/strict';
import {
  PermanentMediaHealth,
  PermanentMediaMirrorProbe,
  resolvePermanentMedia,
} from '../../../src/features/permanent-media';
const refs = ['A', 'B', 'C'].map((value) => `ar://${value.repeat(43)}`);
const mirror = 'https://mirror.example/media';
const storageKey = 'ripples:media-mirror-health:v1';
const audioHeaders = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' };
const probeResponse = () => new Response(new Uint8Array([7]), { status: 206, headers: {
  ...audioHeaders, 'content-range': 'bytes 0-0/42', 'content-length': '1',
} });
class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function verifyDamagedObjectFallback(): Promise<void> {
  const good = new TextEncoder().encode('canonical mirror fallback');
  const expected = await sha256(good);
  for (const mirrorResult of [
    new Response(null, { status: 404 }), new Response('wrong', { headers: audioHeaders }),
  ]) {
    let fullMirrorGets = 0;
    const fetcher: typeof fetch = async (input, init) => {
      if (String(input).startsWith(mirror)) {
        if (new Headers(init?.headers).get('range')) return probeResponse();
        fullMirrorGets += 1; return mirrorResult;
      }
      return new Response(good, { headers: audioHeaders });
    };
    const result = await resolvePermanentMedia(refs[0], {
      kind: 'audio', validation: { level: 'canonical', sha256: expected }, fetcher,
      mirrorBaseUrl: mirror, rounds: 1, health: new PermanentMediaHealth(),
      mirrorProbe: new PermanentMediaMirrorProbe({ storage: null }),
    });
    assert.equal(result.source, 'ardrive');
    assert.equal(fullMirrorGets, 1, '完整对象失败必须逐对象回退');
  }
}

async function verifyServiceAndObjectHealthSplit(): Promise<void> {
  const good = new TextEncoder().encode('audio');
  let serviceGets = 0;
  const serviceGate = new PermanentMediaMirrorProbe({ storage: null });
  const serviceFetcher: typeof fetch = async (input, init) => {
    if (!String(input).startsWith(mirror)) return new Response(good, { headers: audioHeaders });
    if (new Headers(init?.headers).get('range')) return probeResponse();
    serviceGets += 1; return new Response(null, { status: 503 });
  };
  const base = { kind: 'audio', validation: { level: 'compatibility' }, mirrorBaseUrl: mirror,
    rounds: 1, health: new PermanentMediaHealth(), mirrorProbe: serviceGate } as const;
  for (const ref of refs) await resolvePermanentMedia(ref, { ...base, fetcher: serviceFetcher });
  assert.equal(serviceGets, 1, '服务失败后必须进入持久长退避');

  let objectGets = 0;
  const objectGate = new PermanentMediaMirrorProbe({ storage: null });
  const objectHealth = new PermanentMediaHealth({ failureThreshold: 2, cooldownMs: 60_000 });
  const objectFetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith(mirror)) return new Response(good, { headers: audioHeaders });
    if (new Headers(init?.headers).get('range')) return probeResponse();
    objectGets += 1;
    return url.endsWith('C'.repeat(43))
      ? new Response(good, { headers: audioHeaders }) : new Response(null, { status: 404 });
  };
  const objectBase = { ...base, health: objectHealth, mirrorProbe: objectGate };
  const results = [];
  for (const ref of refs) results.push(await resolvePermanentMedia(ref, { ...objectBase, fetcher: objectFetcher }));
  assert.equal(results[2].source, 'mirror');
  assert.equal(objectGets, 3, '两个对象 404 不得误伤第三个镜像对象');
}

async function verifyConcurrentBackoff(): Promise<void> {
  const storage = new MemoryStorage();
  let now = 1_000;
  let fullGets = 0;
  const gate = new PermanentMediaMirrorProbe({
    storage, now: () => now, cooldownsMs: [300, 600, 900, 1_200],
  });
  const fetcher: typeof fetch = async (input, init) => {
    if (!String(input).startsWith(mirror)) {
      return new Response('audio', { headers: audioHeaders });
    }
    if (new Headers(init?.headers).get('range')) return probeResponse();
    fullGets += 1;
    await Promise.resolve();
    return new Response(null, { status: 503 });
  };
  const base = { kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: mirror, rounds: 1, health: new PermanentMediaHealth(), mirrorProbe: gate } as const;
  await Promise.all(refs.map((ref) => resolvePermanentMedia(ref, base)));
  const saved = JSON.parse(storage.getItem(storageKey) ?? '{}') as {
    entries?: Record<string, { level: number; nextProbeAt: number }>;
  };
  assert.equal(fullGets, refs.length);
  assert.equal(saved.entries?.['https://mirror.example']?.level, 0,
    '同一批并发服务失败只能提升一档');
  assert.equal(saved.entries?.['https://mirror.example']?.nextProbeAt, 1_300);

  let refreshedCalls = 0;
  const refreshed = new PermanentMediaMirrorProbe({ storage, now: () => now });
  assert.equal(await refreshed.select(refs[0], {
    fetcher: async () => { refreshedCalls += 1; return probeResponse(); }, mirrorBaseUrl: mirror,
  }), '');
  assert.equal(refreshedCalls, 0, '完整 GET 服务失败必须跨刷新继续跳过镜像');
  now += 301;

  const escalating = new PermanentMediaMirrorProbe({
    storage, now: () => now, cooldownsMs: [300, 600, 900, 1_200],
  });
  const stillDown: typeof fetch = async (input, init) => {
    if (!String(input).startsWith(mirror)) return new Response('audio', { headers: audioHeaders });
    if (new Headers(init?.headers).get('range')) return probeResponse();
    return new Response(null, { status: 503 });
  };
  await resolvePermanentMedia(refs[0], { ...base, fetcher: stillDown,
    health: new PermanentMediaHealth(), mirrorProbe: escalating });
  const escalated = JSON.parse(storage.getItem(storageKey) ?? '{}') as {
    entries?: Record<string, { level: number }>;
  };
  assert.equal(escalated.entries?.['https://mirror.example']?.level, 1,
    'half-open 探针成功但完整下载失败必须升到下一档');

  now += 601;
  const recovered = new PermanentMediaMirrorProbe({
    storage, now: () => now, cooldownsMs: [300, 600, 900, 1_200],
  });
  const healthy: typeof fetch = async (input, init) => {
    if (String(input).startsWith(mirror) && new Headers(init?.headers).get('range')) {
      return probeResponse();
    }
    return new Response('audio', { headers: audioHeaders });
  };
  const result = await resolvePermanentMedia(refs[0], { ...base, fetcher: healthy,
    health: new PermanentMediaHealth(), mirrorProbe: recovered });
  assert.equal(result.source, 'mirror');
  assert.equal(storage.getItem(storageKey), null, '完整镜像对象验证成功后才清除失败等级');
}

async function verifyServiceFailureKinds(): Promise<void> {
  const failures: Array<[string, () => Promise<Response>]> = [
    ['429', async () => new Response(null, { status: 429 })],
    ['网络错误', async () => { throw new TypeError('fetch failed'); }],
  ];
  for (const [label, failure] of failures) {
    const storage = new MemoryStorage();
    let mirrorGets = 0;
    const fetcher: typeof fetch = async (input, init) => {
      if (!String(input).startsWith(mirror)) return new Response('audio', { headers: audioHeaders });
      if (new Headers(init?.headers).get('range')) return probeResponse();
      mirrorGets += 1;
      return failure();
    };
    await resolvePermanentMedia(refs[0], {
      kind: 'audio', validation: { level: 'compatibility' }, fetcher,
      mirrorBaseUrl: mirror, rounds: 1, health: new PermanentMediaHealth(),
      mirrorProbe: new PermanentMediaMirrorProbe({ storage }),
    });
    assert.equal(mirrorGets, 1, label);
    assert.ok(storage.getItem(storageKey), `${label} 必须进入持久退避`);
  }
}

async function verifyFullGetDeadline(): Promise<void> {
  let fullGetAborted = false;
  const fetcher: typeof fetch = async (input, init) => {
    if (!String(input).startsWith(mirror)) return new Response('audio', { headers: audioHeaders });
    if (new Headers(init?.headers).get('range')) return probeResponse();
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => {
      fullGetAborted = true;
      reject(new DOMException('已取消', 'AbortError'));
    }, { once: true }));
  };
  const started = performance.now();
  const result = await resolvePermanentMedia(refs[0], {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: mirror, rounds: 1, health: new PermanentMediaHealth(), mirrorBudgetMs: 10,
    mirrorProbe: new PermanentMediaMirrorProbe({ storage: null }),
  });
  assert.equal(result.source, 'ardrive');
  assert.equal(fullGetAborted, true, '完整镜像 GET 超过总预算必须 Abort');
  assert.ok(performance.now() - started < 100, '镜像探针与完整 GET 必须共用有界总预算');
}

export async function verifyMirrorObjectFallback(): Promise<void> {
  await verifyDamagedObjectFallback();
  await verifyServiceAndObjectHealthSplit();
  await verifyConcurrentBackoff();
  await verifyServiceFailureKinds();
  await verifyFullGetDeadline();
}
