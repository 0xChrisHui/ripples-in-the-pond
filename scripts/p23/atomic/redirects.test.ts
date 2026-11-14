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

for (const [id, sandbox] of [
  ['gnWKBqFXMJrrksEWrXLQRUQQQeFhv4uVxesHBcT8i6o', 'qj2yubvbk4yjv24syelk24wqivcbaqpbmg7yxfof5mdqlrh4rova'],
  ['KvzBpXTEMGkFrDnfUyejXmYc_2mHJKvVnGAr-r-Lpfk', 'fl6mdjluyqygsbnmhhpvgj5dlztbz73jq4skxvm4mav7vp4lux4q'],
  ['ZXcbn768xvGnolueIbmSTHEdflSkna82jQbqvXNoHuo', 'mv3rxh56xtdpdj5clopcdomsjryr27suuso26nuna3vl243id3va'],
]) test(`主域跳转缺少地址时按官方算法读取同一资源：${id}`, async () => {
  const urls: string[] = [];
  await verifyGatewayResource({ ...identity, arTxId: id }, async url => {
    urls.push(String(url));
    return urls.length === 1 ? new Response(null, { status: 302 })
      : new Response(body, { headers: { 'content-type': identity.mime } });
  });
  assert.deepEqual(urls, [`https://arweave.net/${id}`, `https://${sandbox}.arweave.net/${id}`]);
});
test('资源子域也缺少跳转地址时继续等待，不能猜测其他网关', async () => {
  let calls = 0;
  await assert.rejects(verifyGatewayResource(identity, async () => {
    calls++; return new Response(null, { status: 302 });
  }), PermanentResourcePendingError);
  assert.equal(calls, 2);
});
test('推导子域后的错误内容也必须拦截', async () => {
  let calls = 0;
  await assert.rejects(verifyGatewayResource(identity, async () => ++calls === 1
    ? new Response(null, { status: 302 })
    : new Response(Buffer.from('x'.repeat(body.length)), { headers: { 'content-type': identity.mime } })), /CRITICAL/);
});
