import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyGatewayResource } from '../../../app/api/cron/process-score-queue/atomic/readiness';
import { PermanentResourcePendingError } from '../../../src/lib/permanent-core/permanent-wait';

const body = Buffer.from('{"name":"Ripples #12"}');
const identity = { arTxId: 'a'.repeat(43), bytes: body.length,
  sha256: createHash('sha256').update(body).digest('hex'), mime: 'application/json' };
const root = `https://arweave.net/${identity.arTxId}`;
const target = `https://${'b'.repeat(52)}.arweave.net/${identity.arTxId}`;
for (const status of [301, 302, 303, 307, 308]) test(`生产返回 ${status} 时显式跟随网关跳转并验证最终内容`, async () => {
  const requests: string[] = []; let signal: AbortSignal | null | undefined;
  await verifyGatewayResource(identity, async (url, options) => {
    requests.push(String(url)); assert.equal(options?.redirect, 'manual');
    if (!signal) signal = options?.signal;
    else assert.equal(options?.signal, signal, '全部跳转共用八秒预算');
    return String(url) === root ? new Response(null, { status, headers: { location: target } })
      : new Response(body, { headers: { 'content-type': identity.mime } });
  });
  assert.deepEqual(requests, [root, target]);
});
for (const destination of ['https://example.com/a', 'http://127.0.0.1/',
  `https://${'b'.repeat(52)}.arweave.net/another-id`, `https://user:password@arweave.net/${identity.arTxId}`]) {
  test(`拒绝越界跳转：${destination}`, async () => {
    let calls = 0;
    await assert.rejects(verifyGatewayResource(identity, async () => {
      calls++; return new Response(null, { status: 302, headers: { location: destination } });
    }), /CRITICAL/);
    assert.equal(calls, 1);
  });
}
test('跳转循环有次数上限，仍归为网络等待', async () => {
  let calls = 0;
  await assert.rejects(verifyGatewayResource(identity, async () => {
    calls++; return new Response(null, { status: 302, headers: { location: root } });
  }), PermanentResourcePendingError);
  assert.equal(calls, 4);
});
test('跳转最终内容错误不能通过身份校验', async () => {
  await assert.rejects(verifyGatewayResource(identity, async url => String(url) === root
    ? new Response(null, { status: 302, headers: { location: target } })
    : new Response(Buffer.from('x'.repeat(body.length)), { headers: { 'content-type': identity.mime } })), /CRITICAL/);
});
