import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyGatewayResource } from '../../../app/api/cron/process-score-queue/atomic/readiness';
import { PermanentResourcePendingError } from '../../../src/lib/permanent-core/permanent-wait';

const body = Buffer.from('{"name":"Ripples #12"}');
const identity = { arTxId: 'a'.repeat(43), bytes: body.length,
  sha256: createHash('sha256').update(body).digest('hex'), mime: 'application/json' };
test('指定 arweave.net 全文与身份都匹配才放行', async () => {
  await verifyGatewayResource(identity, async (url) => {
    assert.equal(url, `https://arweave.net/${identity.arTxId}`);
    return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8' } });
  });
});
for (const status of [202, 404, 429, 503]) test(`网关 ${status} 只能等待，不能发行`, async () => {
  await assert.rejects(verifyGatewayResource(identity, async () => new Response('', { status })), PermanentResourcePendingError);
});
test('网关连接失败属于传播等待', async () => {
  await assert.rejects(verifyGatewayResource(identity, async () => { throw Error('timeout'); }), PermanentResourcePendingError);
});
test('传播等待保留 HTTP 原因和资源编号，避免生产日志无法定位', async () => {
  await assert.rejects(verifyGatewayResource(identity, async () => new Response('', { status: 404 })),
    (error: unknown) => error instanceof PermanentResourcePendingError
      && error.message.includes('HTTP 404') && error.message.includes(identity.arTxId));
});
for (const [label, value, mime] of [['哈希', Buffer.from('x'.repeat(body.length)), identity.mime],
  ['字节数', Buffer.from('{}'), identity.mime], ['类型', body, 'text/html']] as const) {
  test(`HTTP 200 但${label}不符必须人工复核`, async () => {
    await assert.rejects(verifyGatewayResource(identity, async () => new Response(value, { headers: { 'content-type': mime } })), /^Error: CRITICAL/);
  });
}
