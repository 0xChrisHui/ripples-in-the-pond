import type { NormalizedSoundsMap } from './types';

const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;
const ARWEAVE_GATEWAYS = [
  'https://arweave.net',
  'https://ario.permagate.io',
] as const;
const FETCH_ROUNDS = 2;
const RETRY_DELAY_MS = 400;
const MAX_JSON_BYTES = 128 * 1024;

type Fetcher = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function txIdFromRef(ref: string): string {
  if (!ref.startsWith('ar://')) throw new Error('永久资源必须使用 ar:// 引用');
  const txId = ref.slice(5);
  if (!TX_ID_RE.test(txId)) throw new Error('永久资源包含无效的 Arweave txId');
  return txId;
}

function candidates(ref: string): string[] {
  const txId = txIdFromRef(ref);
  return ARWEAVE_GATEWAYS.map((gateway) => `${gateway}/${txId}`);
}

function abortableDelay(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, RETRY_DELAY_MS);
    signal?.addEventListener('abort', () => {
      globalThis.clearTimeout(timer);
      reject(signal.reason ?? new DOMException('请求已取消', 'AbortError'));
    }, { once: true });
  });
}

/** 浏览器侧沿用项目固定双网关；两轮均失败后才暴露安全错误。 */
export async function fetchPermanentBytes(
  ref: string,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const errors: string[] = [];
  for (let round = 0; round < FETCH_ROUNDS; round += 1) {
    for (const url of candidates(ref)) {
      try {
        const response = await fetcher(url, { signal });
        if (response.ok) return response.arrayBuffer();
        errors.push(`${new URL(url).host}: HTTP ${response.status}`);
      } catch (error) {
        if (signal?.aborted) throw error;
        errors.push(`${new URL(url).host}: 网络错误`);
      }
    }
    if (round + 1 < FETCH_ROUNDS) await abortableDelay(signal);
  }
  throw new Error(`永久资源暂时不可用（${errors.join('；')}）`);
}

export async function fetchPermanentJson(
  ref: string,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  const bytes = await fetchPermanentBytes(ref, fetcher, signal);
  if (bytes.byteLength > MAX_JSON_BYTES) throw new Error('永久 JSON 超过 128KiB 安全上限');
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error('永久 JSON 无法解析');
  }
}

/** 兼容旧平铺字符串、v1 对象式与 v2 `{ version, sounds }`。 */
export function parseSoundsMap(raw: unknown): NormalizedSoundsMap {
  if (!isRecord(raw)) throw new Error('音效表必须是 JSON 对象');
  let table: Record<string, unknown> = raw;
  if ('sounds' in raw) {
    if (raw.version !== 1 && raw.version !== 2) throw new Error('音效表版本不受支持');
    if (!isRecord(raw.sounds)) throw new Error('音效表 sounds 字段无效');
    table = raw.sounds;
  }

  const normalized: Record<string, { key: string; txId: string; name: string | null }> = {};
  for (const [rawKey, value] of Object.entries(table)) {
    const key = rawKey.trim().toLowerCase();
    if (!key || key.length > 32) throw new Error('音效表包含无效键名');
    let txId: string | undefined;
    let name: string | null = null;
    if (typeof value === 'string') {
      txId = value;
    } else if (isRecord(value)) {
      txId = typeof value.txId === 'string' ? value.txId : undefined;
      name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null;
    }
    if (!txId || !TX_ID_RE.test(txId)) throw new Error(`音效键 ${key} 的 Arweave txId 无效`);
    if (normalized[key]) throw new Error(`音效表包含重复键 ${key}`);
    normalized[key] = { key, txId, name };
  }
  if (Object.keys(normalized).length === 0) throw new Error('音效表没有可播放条目');
  return normalized;
}
