import type { NormalizedSoundsMap } from './types';
import { PermanentMediaError, resolvePermanentMedia } from '@/src/features/permanent-media';

const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;
const MAX_JSON_BYTES = 128 * 1024;
const SCORE_HISTORY_VALIDATION = { level: 'compatibility' } as const;

type Fetcher = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 历史 Score 没有 canonical hash，显式走兼容验证但仍检查类型和长度。 */
export async function fetchPermanentBytes(
  ref: string,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  try {
    const result = await resolvePermanentMedia(ref, {
      kind: 'audio', validation: SCORE_HISTORY_VALIDATION, fetcher, signal,
    });
    return result.bytes;
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('请求已取消', 'AbortError');
    throw error;
  }
}

export async function fetchPermanentJson(
  ref: string,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    const result = await resolvePermanentMedia(ref, {
      kind: 'json', validation: SCORE_HISTORY_VALIDATION,
      fetcher, signal, maxBytes: MAX_JSON_BYTES,
    });
    return JSON.parse(new TextDecoder().decode(result.bytes)) as unknown;
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('请求已取消', 'AbortError');
    if (error instanceof PermanentMediaError && error.attempts.length > 0
      && error.attempts.every((attempt) => attempt.kind === 'too-large')) {
      throw new Error('永久 JSON 超过 128KiB 安全上限');
    }
    if (error instanceof SyntaxError) throw new Error('永久 JSON 无法解析');
    throw error;
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
