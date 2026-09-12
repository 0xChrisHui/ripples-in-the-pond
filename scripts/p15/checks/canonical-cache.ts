import assert from 'node:assert/strict';
import {
  PermanentMediaHealth,
  resolvePermanentMedia,
} from '../../../src/features/permanent-media';

const REF = `ar://${'A'.repeat(43)}`;
const AUDIO_HEADERS = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' };

function response(body: BodyInit): Response {
  return new Response(body, { status: 200, headers: AUDIO_HEADERS });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** 验证 canonical 独占缓存、命中复验，以及损坏缓存回源修复。 */
export async function verifyCanonicalCache(): Promise<void> {
  const stored = new Map<string, Response>();
  let fetches = 0;
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
    const bytes = new TextEncoder().encode('cached canonical bytes');
    const expected = await sha256(bytes);
    const online: typeof fetch = async () => { fetches += 1; return response(bytes); };
    await assert.rejects(resolvePermanentMedia(REF, { kind: 'audio',
      validation: { level: 'canonical', sha256: '0'.repeat(64) }, fetcher: online,
      mirrorBaseUrl: '', rounds: 1, health: new PermanentMediaHealth() }));
    assert.equal(stored.size, 0, 'SHA-256 未通过时不得写入缓存');
    fetches = 0;
    const options = { kind: 'audio', validation: { level: 'canonical', sha256: expected },
      mirrorBaseUrl: '', rounds: 1,
      health: new PermanentMediaHealth({ failureThreshold: 2 }) } as const;
    assert.equal((await resolvePermanentMedia(REF, { ...options, fetcher: online })).source, 'ardrive');
    assert.equal(stored.size, 1, 'canonical 成功后必须写入缓存');
    const offline: typeof fetch = async () => { throw new Error('不应访问网络'); };
    assert.equal((await resolvePermanentMedia(REF, { ...options, fetcher: offline })).source, 'cache');
    const key = [...stored.keys()][0];
    stored.set(key, response('corrupt'));
    assert.equal((await resolvePermanentMedia(REF, { ...options, fetcher: online })).source, 'ardrive');
    assert.equal(fetches, 2, '坏缓存必须删除并回源');
    stored.clear();
    await resolvePermanentMedia(REF, { kind: 'audio', validation: { level: 'compatibility' },
      fetcher: online, mirrorBaseUrl: '', rounds: 1, health: new PermanentMediaHealth() });
    assert.equal(stored.size, 0, 'compatibility 响应不得进入验证缓存');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor);
    else Reflect.deleteProperty(globalThis, 'caches');
  }
}
