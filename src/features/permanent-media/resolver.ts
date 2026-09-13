import { permanentMediaCandidates } from './candidates';
import { sharedPermanentMediaHealth } from './health';
import { sharedPermanentMediaMirrorProbe } from './mirror-probe';
import { AttemptError, readBounded, verifyResponse } from './response-validation';
import { readVerifiedCache, sha256Hex, writeVerifiedCache } from './verified-cache';
import {
  PermanentMediaError,
  type PermanentMediaCandidate,
  type PermanentMediaFailure,
  type PermanentMediaOptions,
  type PermanentMediaResult,
} from './types';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MIRROR_BUDGET_MS = 900;
const DEFAULT_ROUNDS = 2;
const DEFAULT_RETRY_DELAY_MS = 300;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const JSON_MAX_BYTES = 128 * 1024;
const SHA256_RE = /^[0-9a-f]{64}$/;
function abortError(): PermanentMediaError {
  return new PermanentMediaError('aborted', '永久资源请求已取消');
}
function classifyNetwork(error: unknown): AttemptError {
  const message = error instanceof Error ? error.message : String(error);
  const kind = /dns|enotfound|name.?not.?resolved/i.test(message) ? 'dns' : 'network';
  return new AttemptError(kind);
}
async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  if (externalSignal?.aborted) throw abortError();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removeAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new AttemptError('timeout'));
    }, timeoutMs);
    const onAbort = () => {
      controller.abort(externalSignal?.reason);
      reject(abortError());
    };
    externalSignal?.addEventListener('abort', onAbort, { once: true });
    removeAbort = () => externalSignal?.removeEventListener('abort', onAbort);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
    removeAbort?.();
  }
}
function expectedHash(options: PermanentMediaOptions): string | undefined {
  const expected = options.validation.sha256;
  if (expected === undefined && options.validation.level === 'compatibility') return undefined;
  if (!expected || !SHA256_RE.test(expected)) {
    throw new PermanentMediaError('hash-mismatch', '永久资源 SHA-256 格式无效');
  }
  return expected;
}

async function attempt(
  candidate: PermanentMediaCandidate,
  options: PermanentMediaOptions,
  maxBytes: number,
  timeoutMs: number,
  expected: string | undefined,
): Promise<PermanentMediaResult> {
  return withDeadline(async (signal) => {
    let response: Response;
    try {
      response = await (options.fetcher ?? fetch)(candidate.url, { signal });
    } catch (error) {
      if (signal.aborted) throw new AttemptError('timeout');
      throw classifyNetwork(error);
    }
    if (!response.ok) throw new AttemptError('http', response.status);
    const contentType = response.headers.get('content-type');
    verifyResponse(options, response, maxBytes);
    const bytes = await readBounded(response, maxBytes);
    if (expected && await sha256Hex(bytes) !== expected) throw new AttemptError('hash-mismatch');
    return {
      bytes, contentType, source: candidate.source,
      verification: expected ? 'sha256' : 'compatibility',
    };
  }, options.signal, timeoutMs);
}

function failureText(candidate: PermanentMediaCandidate, error: AttemptError): string {
  const detail = error.kind === 'http' ? `HTTP ${error.status}` : {
    timeout: '超时', dns: 'DNS 失败', network: '网络错误',
    'content-type': '类型不符', range: '不支持 Range',
    'too-large': '长度超限', 'hash-mismatch': '哈希不符',
  }[error.kind];
  return `${candidate.label}: ${detail}`;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** 解析永久引用；只有字节通过当前验证等级后候选才算成功。 */
export async function resolvePermanentMedia(
  ref: string,
  options: PermanentMediaOptions,
): Promise<PermanentMediaResult> {
  const expected = expectedHash(options);
  const health = options.health ?? sharedPermanentMediaHealth;
  const maxBytes = options.maxBytes ?? (options.kind === 'json' ? JSON_MAX_BYTES : DEFAULT_MAX_BYTES);
  const cacheable = options.validation.level === 'canonical' && expected !== undefined;
  if (options.signal?.aborted) throw abortError();
  const cached = cacheable ? await readVerifiedCache(expected, maxBytes) : null;
  if (options.signal?.aborted) throw abortError();
  if (cached) {
    if (options.kind === 'audio') performance.mark('p15:first-verified-audio-ready');
    return { ...cached, source: 'cache', verification: 'sha256' };
  }
  const mirrorStartedAt = performance.now();
  const mirrorBudgetMs = Math.max(1, options.mirrorBudgetMs ?? DEFAULT_MIRROR_BUDGET_MS);
  const mirrorProbe = options.mirrorProbe ?? sharedPermanentMediaMirrorProbe;
  const mirrorBaseUrl = options.kind === 'audio'
    ? await mirrorProbe.select(ref, {
      fetcher: options.fetcher ?? fetch, signal: options.signal,
      mirrorBaseUrl: options.mirrorBaseUrl,
      timeoutMs: Math.min(options.mirrorProbeTimeoutMs ?? 800, mirrorBudgetMs),
    })
    : '';
  if (options.signal?.aborted) throw abortError();
  const candidates = permanentMediaCandidates(ref, mirrorBaseUrl);
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const rounds = Math.max(1, options.rounds ?? DEFAULT_ROUNDS);
  const failures: PermanentMediaFailure[] = [];
  const messages: string[] = [];
  let mirrorDisabled = false;
  for (let round = 0; round < rounds; round += 1) {
    for (const candidate of candidates) {
      if (candidate.source === 'mirror' && mirrorDisabled) continue;
      if (!health.canAttempt(candidate.healthKey)) continue;
      try {
        const candidateTimeout = candidate.source === 'mirror'
          ? Math.max(1, mirrorBudgetMs - (performance.now() - mirrorStartedAt)) : timeoutMs;
        const result = await attempt(candidate, options, maxBytes, candidateTimeout, expected);
        health.recordSuccess(candidate.healthKey);
        if (candidate.source === 'mirror') {
          mirrorProbe.recordServiceSuccess?.(candidate.healthKey);
        }
        if (cacheable) await writeVerifiedCache(expected, result.bytes, result.contentType);
        if (options.kind === 'audio') performance.mark('p15:first-verified-audio-ready');
        return result;
      } catch (error) {
        if (options.signal?.aborted) throw abortError();
        if (error instanceof PermanentMediaError && error.kind === 'aborted') throw error;
        const classified = error instanceof AttemptError ? error : classifyNetwork(error);
        const mirrorServiceFailure = candidate.source === 'mirror' && (
          ['timeout', 'dns', 'network'].includes(classified.kind)
          || (classified.kind === 'http' && (
            classified.status === 403 || classified.status === 429 || (classified.status ?? 0) >= 500
          ))
        );
        const candidateHealthFailure = candidate.source === 'mirror'
          ? mirrorServiceFailure : ['timeout', 'dns', 'network', 'http'].includes(classified.kind);
        if (candidateHealthFailure) health.recordFailure(candidate.healthKey, classified.kind);
        if (mirrorServiceFailure) {
          mirrorDisabled = true;
          mirrorProbe.recordServiceFailure?.(candidate.healthKey);
        }
        failures.push({ source: candidate.source, kind: classified.kind, status: classified.status });
        messages.push(failureText(candidate, classified));
      }
    }
    if (round + 1 < rounds) await delay(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS, options.signal);
  }
  throw new PermanentMediaError(
    'unavailable', `永久资源暂时不可用（${messages.join('；') || '候选处于冷却中'}）`, failures,
  );
}
