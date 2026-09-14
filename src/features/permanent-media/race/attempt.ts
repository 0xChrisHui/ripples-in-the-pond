import { AttemptError, readBounded, verifyResponse } from '../response-validation';
import { sha256Hex } from '../verified-cache';
import {
  PermanentMediaError,
  type PermanentMediaCandidate,
  type PermanentMediaOptions,
  type PermanentMediaResult,
} from '../types';

export function abortError(): PermanentMediaError {
  return new PermanentMediaError('aborted', '永久资源请求已取消');
}

export function classifyNetwork(error: unknown): AttemptError {
  const message = error instanceof Error ? error.message : String(error);
  const kind = /dns|enotfound|name.?not.?resolved/i.test(message) ? 'dns' : 'network';
  return new AttemptError(kind);
}

async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  branchSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  if (branchSignal?.aborted) throw abortError();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removeAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new AttemptError('timeout'));
    }, timeoutMs);
    const onAbort = () => {
      controller.abort(branchSignal?.reason);
      reject(abortError());
    };
    branchSignal?.addEventListener('abort', onAbort, { once: true });
    removeAbort = () => branchSignal?.removeEventListener('abort', onAbort);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
    removeAbort?.();
  }
}

export async function attemptCandidate(
  candidate: PermanentMediaCandidate,
  options: PermanentMediaOptions,
  maxBytes: number,
  timeoutMs: number,
  expected: string | undefined,
  branchSignal: AbortSignal | undefined,
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
  }, branchSignal, timeoutMs);
}
