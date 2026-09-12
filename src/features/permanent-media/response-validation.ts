import type { PermanentMediaFailureKind, PermanentMediaOptions } from './types';

export class AttemptError extends Error {
  constructor(
    public readonly kind: Exclude<PermanentMediaFailureKind, 'aborted' | 'unavailable'>,
    public readonly status?: number,
  ) {
    super(kind);
  }
}

function acceptedType(kind: PermanentMediaOptions['kind'], raw: string | null): boolean {
  if (!raw) return false;
  const value = raw.split(';', 1)[0].trim().toLowerCase();
  if (kind === 'json') return ['application/json', 'text/json', 'text/plain'].includes(value);
  if (kind === 'audio') return value.startsWith('audio/') || value === 'application/octet-stream';
  return value !== 'text/html';
}

/** 响应头只能提前拒绝；最终长度和哈希仍以实际读取字节为准。 */
export function verifyResponse(
  options: PermanentMediaOptions,
  response: Response,
  maxBytes: number,
): void {
  const contentType = response.headers.get('content-type');
  if ((!contentType && options.validation.level !== 'compatibility')
    || (contentType && !acceptedType(options.kind, contentType))) {
    throw new AttemptError('content-type');
  }
  const ranges = response.headers.get('accept-ranges')?.toLowerCase();
  if (options.kind === 'audio' && ranges !== 'bytes' && response.status !== 206) {
    throw new AttemptError('range');
  }
  const rawLength = response.headers.get('content-length');
  if (!rawLength) return;
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
    throw new AttemptError('too-large');
  }
}

export async function readBounded(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) throw new AttemptError('too-large');
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new AttemptError('too-large');
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}
