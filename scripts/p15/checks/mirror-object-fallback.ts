import assert from 'node:assert/strict';
import { PermanentMediaHealth, resolvePermanentMedia } from '../../../src/features/permanent-media';

const refs = ['A', 'B', 'C'].map((value) => `ar://${value.repeat(43)}`);
const mirror = 'https://mirror.example/media';
const storageKey = 'ripples:media-mirror-health:v1';
const audioHeaders = { 'content-type': 'audio/mpeg' };

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.writes.push(key); this.values.set(key, value); }
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
    let mirrorGets = 0;
    const fetcher: typeof fetch = async (input) => {
      if (String(input).startsWith(mirror)) { mirrorGets += 1; return mirrorResult; }
      return new Response(good, { headers: audioHeaders });
    };
    const result = await resolvePermanentMedia(refs[0], {
      kind: 'audio', validation: { level: 'canonical', sha256: expected }, fetcher,
      mirrorBaseUrl: mirror, rounds: 1, health: new PermanentMediaHealth(),
    });
    assert.equal(result.source, 'ardrive');
    assert.equal(mirrorGets, 1, '镜像完整对象失败必须逐对象回退');
  }
}

async function verifyShortTabCooldown(): Promise<void> {
  const health = new PermanentMediaHealth({ failureThreshold: 1, cooldownMs: 60_000 });
  let mirrorGets = 0;
  const fetcher: typeof fetch = async (input) => {
    if (String(input).startsWith(mirror)) {
      mirrorGets += 1;
      return new Response(null, { status: 503 });
    }
    return new Response('audio', { headers: audioHeaders });
  };
  for (const ref of refs.slice(0, 2)) {
    await resolvePermanentMedia(ref, {
      kind: 'audio', validation: { level: 'compatibility' }, fetcher,
      mirrorBaseUrl: mirror, rounds: 1, health,
    });
  }
  assert.equal(mirrorGets, 1, '服务失败后只在当前标签页短暂跳过镜像');
}

async function verifyObjectFailuresDoNotCoolOrigin(): Promise<void> {
  const health = new PermanentMediaHealth({ failureThreshold: 1, cooldownMs: 60_000 });
  let mirrorGets = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (!url.startsWith(mirror)) return new Response('audio', { headers: audioHeaders });
    mirrorGets += 1;
    return url.endsWith('C'.repeat(43))
      ? new Response('audio', { headers: audioHeaders })
      : new Response(null, { status: 404 });
  };
  const first = await resolvePermanentMedia(refs[0], {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: mirror, rounds: 1, health,
  });
  const recovered = await resolvePermanentMedia(refs[2], {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: mirror, rounds: 1, health,
  });
  assert.equal(first.source, 'ardrive');
  assert.equal(recovered.source, 'mirror');
  assert.equal(mirrorGets, 2, '单对象 404 不得误伤下一个镜像对象');
}

async function verifyLegacyStorageCleanup(): Promise<void> {
  const storage = new MemoryStorage();
  storage.values.set(storageKey, '{"schema":1,"entries":{"legacy":true}}');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    await resolvePermanentMedia(refs[0], {
      kind: 'audio', validation: { level: 'compatibility' },
      fetcher: async () => new Response('audio', { headers: audioHeaders }),
      mirrorBaseUrl: '', rounds: 1, health: new PermanentMediaHealth(),
    });
    assert.equal(storage.getItem(storageKey), null, '旧版 24 小时冷却必须一次性清除');
    assert.deepEqual(storage.writes, [], '新热路径不得再持久化镜像健康状态');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

/** 覆盖逐对象回退、标签页内短保护及旧持久冷却迁移。 */
export async function verifyMirrorObjectFallback(): Promise<void> {
  await verifyDamagedObjectFallback();
  await verifyShortTabCooldown();
  await verifyObjectFailuresDoNotCoolOrigin();
  await verifyLegacyStorageCleanup();
}
