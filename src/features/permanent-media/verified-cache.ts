const CACHE_NAME = 'ripples-p14-clips-v1';
const CACHE_KEY_PREFIX = '/__p14_clip_cache__/v1/';

type VerifiedCacheHit = {
  bytes: ArrayBuffer;
  contentType: string | null;
};

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function cacheKey(expectedSha256: string): string {
  return `${CACHE_KEY_PREFIX}${expectedSha256}`;
}

/** 命中仍复验字节；损坏或超限的旧缓存会立即删除，绝不进入播放器。 */
export async function readVerifiedCache(
  expectedSha256: string,
  maxBytes: number,
): Promise<VerifiedCacheHit | null> {
  if (!globalThis.caches) return null;
  try {
    const cache = await globalThis.caches.open(CACHE_NAME);
    const key = cacheKey(expectedSha256);
    const response = await cache.match(key);
    if (!response) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength <= maxBytes && await sha256Hex(bytes) === expectedSha256) {
      return { bytes, contentType: response.headers.get('content-type') };
    }
    await cache.delete(key);
  } catch (error) {
    console.warn('[permanent-media] 读取验证缓存失败，继续请求永久网关：', error);
  }
  return null;
}

/** 调用方只可在 canonical SHA-256 已通过后写入。 */
export async function writeVerifiedCache(
  expectedSha256: string,
  bytes: ArrayBuffer,
  contentType: string | null,
): Promise<void> {
  if (!globalThis.caches) return;
  try {
    const cache = await globalThis.caches.open(CACHE_NAME);
    const headers = contentType ? { 'content-type': contentType } : undefined;
    await cache.put(cacheKey(expectedSha256), new Response(bytes.slice(0), { headers }));
  } catch (error) {
    console.warn('[permanent-media] 写入验证缓存失败，本次播放继续：', error);
  }
}
