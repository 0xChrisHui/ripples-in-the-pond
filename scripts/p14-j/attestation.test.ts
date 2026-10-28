import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { attestPermanentResource, readVerifiedPermanentResource } from '../../src/lib/permanent-core/attestation';
import { PermanentResourcePendingError } from '../../src/lib/permanent-core/permanent-wait';
import { arweaveTxIdOf, arweaveGatewayUrls } from '../../src/lib/arweave/shared';

const gateways = ['https://arweave.net', 'https://ardrive.net', 'https://arweave.tokyo'];
const bytes = Buffer.from('{"events":[]}');
const identity = {
  arTxId: 'A'.repeat(43), bytes: bytes.length, mime: 'application/json',
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
type Outcome = 'ok' | '404' | '202' | 'timeout' | 'body-timeout' | 'sha' | 'bytes' | 'mime';
const requested: string[] = [];
let outcomes: Outcome[] = [];

function isQuorumError(error: unknown, pending: boolean): boolean {
  assert.ok(error instanceof Error);
  assert.ok(error.message.startsWith('永久资源未达到双网关 quorum：'));
  assert.equal(error instanceof PermanentResourcePendingError, pending);
  for (const gateway of gateways) assert.ok(error.message.includes(gateway));
  return true;
}

async function main(): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    const index = gateways.findIndex((gateway) => url === `${gateway}/${identity.arTxId}`);
    // 未列入三家候选的请求直接失败，避免测试掩盖仍在访问旧网关的缺陷。
    const outcome = index < 0 ? '404' : outcomes[index];
    if (outcome === 'timeout') throw new DOMException('网关超时', 'TimeoutError');
    if (outcome === '404') return new Response(null, { status: 404 });
    if (outcome === '202') return new Response('Pending', { status: 202, headers: { 'content-type': 'text/plain' } });
    const response = new Response(
      outcome === 'sha' ? Buffer.from('{"events":{}}') : outcome === 'bytes' ? bytes.subarray(1) : bytes,
      { headers: { 'content-type': outcome === 'mime' ? 'text/html' : 'Application/JSON; charset=utf-8' } },
    );
    if (outcome === 'body-timeout') {
      response.arrayBuffer = async () => { throw new DOMException('响应体超时', 'TimeoutError'); };
    }
    return response;
  };
  try {
    outcomes = ['ok', 'ok', 'ok'];
    assert.deepEqual(await attestPermanentResource(identity), new Uint8Array(bytes));
    for (let index = 0; index < 3; index += 1) {
      for (const failure of ['404', '202', 'timeout', 'body-timeout', 'sha', 'bytes', 'mime'] as const) {
        outcomes = ['ok', 'ok', 'ok'];
        outcomes[index] = failure;
        assert.deepEqual(await attestPermanentResource(identity), new Uint8Array(bytes));
      }
    }
    for (const onlyHealthy of [0, 1, 2]) {
      outcomes = ['404', 'timeout', '404'];
      outcomes[onlyHealthy] = 'ok';
      await assert.rejects(attestPermanentResource(identity), (error) => isQuorumError(error, true));
    }
    outcomes = ['ok', 'body-timeout', 'timeout'];
    await assert.rejects(attestPermanentResource(identity), (error) => isQuorumError(error, true));
    // 传播中的 202 占位页算“暂不可读”（等待），不是身份冲突。
    for (const pendingMix of [['ok', '202', '202'], ['202', '404', '202'], ['202', '202', '202']] as const) {
      outcomes = [...pendingMix];
      await assert.rejects(attestPermanentResource(identity), (error) => isQuorumError(error, true));
    }
    for (const corrupt of ['sha', 'bytes', 'mime'] as const) {
      outcomes = ['ok', corrupt, corrupt];
      await assert.rejects(attestPermanentResource(identity), (error) => isQuorumError(error, false));
      outcomes = ['ok', corrupt, '404'];
      await assert.rejects(attestPermanentResource(identity), (error) => isQuorumError(error, false));
    }
    outcomes = ['404', '404', '404'];
    await assert.rejects(attestPermanentResource(identity), (error) => isQuorumError(error, true));
    outcomes = ['404', 'ok', '404'];
    assert.deepEqual(await readVerifiedPermanentResource(identity), new Uint8Array(bytes));
    const historical = `https://ario.permagate.io/${identity.arTxId}`;
    assert.equal(arweaveTxIdOf(historical), identity.arTxId);
    assert.equal(arweaveGatewayUrls(historical).length, 3);
    assert.ok(requested.length > 0);
    assert.ok(requested.every((url) => !url.includes('ario.permagate.io')));
    assert.deepEqual(new Set(requested.map((url) => new URL(url).origin)), new Set(gateways));
    console.log('通过');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
