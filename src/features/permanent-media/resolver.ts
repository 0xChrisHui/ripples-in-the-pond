import { permanentMediaCandidates } from './candidates';
import { sharedPermanentMediaHealth } from './health';
import { sharedPermanentMediaMirrorProbe } from './mirror-probe';
import { abortError, attemptCandidate, classifyNetwork } from './race/attempt';
import { AttemptError } from './response-validation';
import { readVerifiedCache, writeVerifiedCache } from './verified-cache';
import {
  PermanentMediaError,
  type PermanentMediaCandidate,
  type PermanentMediaFailure,
  type PermanentMediaOptions,
  type PermanentMediaResult,
} from './types';

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MIRROR_TIMEOUT_MS = 10_000;
const DEFAULT_MIRROR_PROBE_TIMEOUT_MS = 2_000;
const DEFAULT_MIRROR_FALLBACK_DELAY_MS = 1_200;
const DEFAULT_ROUNDS = 2;
const DEFAULT_RETRY_DELAY_MS = 300;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const JSON_MAX_BYTES = 128 * 1024;
const SHA256_RE = /^[0-9a-f]{64}$/;

type FailureLog = { failures: PermanentMediaFailure[]; messages: string[] };

function expectedHash(options: PermanentMediaOptions): string | undefined {
  const expected = options.validation.sha256;
  if (expected === undefined && options.validation.level === 'compatibility') return undefined;
  if (!expected || !SHA256_RE.test(expected)) {
    throw new PermanentMediaError('hash-mismatch', '永久资源 SHA-256 格式无效');
  }
  return expected;
}

function failureText(candidate: PermanentMediaCandidate, error: AttemptError): string {
  const detail = error.kind === 'http' ? `HTTP ${error.status}` : {
    timeout: '超时', dns: 'DNS 失败', network: '网络错误',
    'content-type': '类型不符', range: '不支持 Range',
    'too-large': '长度超限', 'hash-mismatch': '哈希不符',
  }[error.kind];
  return `${candidate.label}: ${detail}`;
}

function logFailure(log: FailureLog, candidate: PermanentMediaCandidate, error: AttemptError): void {
  log.failures.push({ source: candidate.source, kind: error.kind, status: error.status });
  log.messages.push(failureText(candidate, error));
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function resolveGateways(
  candidates: readonly PermanentMediaCandidate[], options: PermanentMediaOptions,
  maxBytes: number, expected: string | undefined, signal: AbortSignal | undefined, log: FailureLog,
): Promise<PermanentMediaResult> {
  const health = options.health ?? sharedPermanentMediaHealth;
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const rounds = Math.max(1, options.rounds ?? DEFAULT_ROUNDS);
  for (let round = 0; round < rounds; round += 1) {
    for (const candidate of candidates) {
      if (!health.canAttempt(candidate.healthKey)) continue;
      try {
        const result = await attemptCandidate(candidate, options, maxBytes, timeoutMs, expected, signal);
        health.recordSuccess(candidate.healthKey);
        return result;
      } catch (error) {
        if (signal?.aborted) throw abortError();
        const classified = error instanceof AttemptError ? error : classifyNetwork(error);
        if (['timeout', 'dns', 'network', 'http'].includes(classified.kind)) {
          health.recordFailure(candidate.healthKey, classified.kind);
        }
        logFailure(log, candidate, classified);
      }
    }
    if (round + 1 < rounds) await delay(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS, signal);
  }
  throw new PermanentMediaError(
    'unavailable', `永久资源暂时不可用（${log.messages.join('；') || '候选处于冷却中'}）`, log.failures,
  );
}

function mirrorServiceFailure(error: AttemptError): boolean {
  return ['timeout', 'dns', 'network'].includes(error.kind)
    || (error.kind === 'http' && (
      error.status === 403 || error.status === 429 || (error.status ?? 0) >= 500
    ));
}

async function resolveWithMirrorRace(
  ref: string, options: PermanentMediaOptions, maxBytes: number,
  expected: string | undefined, candidates: readonly PermanentMediaCandidate[], log: FailureLog,
): Promise<PermanentMediaResult> {
  const mirror = candidates.find((candidate) => candidate.source === 'mirror');
  if (!mirror) return resolveGateways(candidates, options, maxBytes, expected, options.signal, log);
  const health = options.health ?? sharedPermanentMediaHealth;
  const probe = options.mirrorProbe ?? sharedPermanentMediaMirrorProbe;
  const mirrorController = new AbortController();
  const gatewayController = new AbortController();
  let startGateway!: () => void;
  let rejectGateway!: (error: unknown) => void;
  let gatewayStarted = false;
  const gatewayStart = new Promise<void>((resolve, reject) => {
    rejectGateway = reject;
    startGateway = () => {
      if (gatewayStarted) return;
      gatewayStarted = true;
      performance.mark('p15:ar-fallback-started');
      resolve();
    };
  });
  const onAbort = () => {
    mirrorController.abort(options.signal?.reason);
    gatewayController.abort(options.signal?.reason);
    rejectGateway(abortError());
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const hedge = setTimeout(startGateway,
    Math.max(1, options.mirrorFallbackDelayMs ?? DEFAULT_MIRROR_FALLBACK_DELAY_MS));
  const gatewayPromise = gatewayStart.then(() => resolveGateways(
    candidates.filter((candidate) => candidate.source !== 'mirror'),
    options, maxBytes, expected, gatewayController.signal, log,
  ));
  const mirrorPromise = (async () => {
    const selected = await probe.select(ref, {
      fetcher: options.fetcher ?? fetch, signal: mirrorController.signal,
      mirrorBaseUrl: options.mirrorBaseUrl,
      timeoutMs: Math.max(1, options.mirrorProbeTimeoutMs ?? DEFAULT_MIRROR_PROBE_TIMEOUT_MS),
    });
    if (!selected) { startGateway(); throw new AttemptError('network'); }
    try {
      const result = await attemptCandidate(mirror, options, maxBytes,
        Math.max(1, options.mirrorTimeoutMs ?? DEFAULT_MIRROR_TIMEOUT_MS),
        expected, mirrorController.signal);
      health.recordSuccess(mirror.healthKey);
      probe.recordServiceSuccess?.(mirror.healthKey);
      return result;
    } catch (error) {
      if (mirrorController.signal.aborted) throw abortError();
      const classified = error instanceof AttemptError ? error : classifyNetwork(error);
      if (mirrorServiceFailure(classified)) {
        health.recordFailure(mirror.healthKey, classified.kind);
        probe.recordServiceFailure?.(mirror.healthKey);
      }
      logFailure(log, mirror, classified);
      startGateway();
      throw classified;
    }
  })();
  try {
    const result = await Promise.any([mirrorPromise, gatewayPromise]);
    if (!gatewayStarted) rejectGateway(abortError());
    mirrorController.abort();
    gatewayController.abort();
    return result;
  } catch {
    if (options.signal?.aborted) throw abortError();
    throw new PermanentMediaError(
      'unavailable', `永久资源暂时不可用（${log.messages.join('；') || '候选处于冷却中'}）`, log.failures,
    );
  } finally {
    clearTimeout(hedge);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

/** 解析永久引用；镜像与永久网关只以完整字节验证结果决胜。 */
export async function resolvePermanentMedia(
  ref: string, options: PermanentMediaOptions,
): Promise<PermanentMediaResult> {
  const expected = expectedHash(options);
  const maxBytes = options.maxBytes ?? (options.kind === 'json' ? JSON_MAX_BYTES : DEFAULT_MAX_BYTES);
  const cacheable = options.validation.level === 'canonical' && expected !== undefined;
  if (options.signal?.aborted) throw abortError();
  const cached = cacheable ? await readVerifiedCache(expected, maxBytes) : null;
  if (options.signal?.aborted) throw abortError();
  if (cached) {
    if (options.kind === 'audio') performance.mark('p15:first-verified-audio-ready');
    return { ...cached, source: 'cache', verification: 'sha256' };
  }
  const mirrorBase = options.kind === 'audio' ? options.mirrorBaseUrl : '';
  const candidates = permanentMediaCandidates(ref, mirrorBase);
  const log: FailureLog = { failures: [], messages: [] };
  const result = await resolveWithMirrorRace(ref, options, maxBytes, expected, candidates, log);
  if (cacheable) await writeVerifiedCache(expected, result.bytes, result.contentType);
  if (options.kind === 'audio') performance.mark('p15:first-verified-audio-ready');
  return result;
}
