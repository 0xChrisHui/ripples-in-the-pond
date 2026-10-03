import assert from 'node:assert/strict';
import { uploadFreeCollection } from './free-upload';

async function main() {
  const bytes = Buffer.from('{"ok":true}');
  const tags = [{ name: 'Content-Type', value: 'application/json' }];
  let requestUrl: unknown;
  let requestInit: RequestInit | undefined;

  const result = await uploadFreeCollection(bytes, tags, async (url, init) => {
    requestUrl = url; requestInit = init;
    return new Response(JSON.stringify({
      id: 'a'.repeat(43), owner: 'turbo', receipt: { winc: '0' },
    }), { status: 201, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(requestUrl, 'https://upload.ardrive.io/v1/x402/upload/unsigned');
  assert.equal(requestInit?.method, 'POST');
  assert.deepEqual(Buffer.from(requestInit?.body as ArrayBuffer), bytes);
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get('x-data-item-tags'), JSON.stringify(tags));
  assert.equal(headers.get('content-type'), 'application/octet-stream');
  assert.equal(headers.has('x-payment'), false);
  assert.equal(headers.has('authorization'), false);
  assert.equal(result.winc, '0');

  await assert.rejects(
    uploadFreeCollection(bytes, tags, async () => new Response('Payment required', { status: 402 })),
    (error: unknown) => error instanceof Error && 'outcome' in error && 'status' in error
      && (error as Error & { outcome: string; status: number }).outcome === 'not_sent'
      && (error as Error & { outcome: string; status: number }).status === 402,
  );
  await assert.rejects(
    uploadFreeCollection(bytes, tags, async () => { throw new Error('connection reset'); }),
    (error: unknown) => error instanceof Error && 'outcome' in error
      && (error as Error & { outcome: string }).outcome === 'unknown',
  );
  console.log('P17 两份小文件使用无签名、无支付参数的免费上传路径：通过');
}

void main();
