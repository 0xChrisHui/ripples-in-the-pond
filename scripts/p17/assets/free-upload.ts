export type FreeUploadResult = {
  id: string;
  owner: string;
  winc: string;
};

type Requester = (url: string, init: RequestInit) => Promise<Response>;
type UploadOutcome = 'not_sent' | 'unknown';

export class FreeUploadError extends Error {
  constructor(message: string, readonly outcome: UploadOutcome, readonly status: number) {
    super(message);
  }
}

const endpoint = 'https://upload.ardrive.io/v1/x402/upload/unsigned';

/** 当前Turbo免费小文件端点；不提供付款签名或额度，402只会明确拒绝。 */
export async function uploadFreeCollection(
  bytes: Buffer,
  tags: { name: string; value: string }[],
  request: Requester = fetch,
): Promise<FreeUploadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); timeout.unref();
  let response: Response;
  try {
    response = await request(endpoint, { method: 'POST', body: Uint8Array.from(bytes).buffer, signal: controller.signal,
      headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.length),
        'x-data-item-tags': JSON.stringify(tags) } });
  } catch {
    throw new FreeUploadError('免费上传网络结果未知', 'unknown', 0);
  } finally { clearTimeout(timeout); }
  if (!response.ok) {
    const outcome = response.status >= 400 && response.status < 500 ? 'not_sent' : 'unknown';
    throw new FreeUploadError(`免费上传HTTP ${response.status}`, outcome, response.status);
  }
  try {
    const body = await response.json() as Record<string, unknown>;
    const receipt = typeof body.receipt === 'object' && body.receipt !== null
      ? body.receipt as Record<string, unknown> : {};
    const result = { id: body.id, owner: body.owner, winc: body.winc ?? receipt.winc };
    if (![result.id, result.owner, result.winc].every((value) => typeof value === 'string')) throw new Error();
    return result as FreeUploadResult;
  } catch { throw new FreeUploadError('免费上传响应无法登记', 'unknown', response.status); }
}
