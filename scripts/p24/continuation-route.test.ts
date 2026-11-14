import test from 'node:test';
import assert from 'node:assert/strict';
import { integration } from './continuation/modules';

test('真实路由在一次调用内完成多个阶段，上传两次、发送两笔，不重复；未认证无副作用', async () => {
  const s = integration();
  assert.equal((await s.tick(false)).status, 401);
  assert.equal(s.uploads.length, 0);
  const reply = await s.tick();
  assert.equal(reply.status, 200);
  assert.equal(reply.body.processed, 1);
  assert.equal(reply.body.orders[0].steps, 10);
  assert.equal(s.db.records.get('1')!.status, 'success');
  assert.equal(s.db.records.get('1')!.locked_by, null);
  assert.equal(s.uploads.length, 2);
  assert.deepEqual(s.sends, ['mintScore', 'setTokenURI']);
  await s.tick();
  assert.equal(s.uploads.length, 2); assert.equal(s.sends.length, 2);
});

test('真实上传后等待传播，连续路由保留退避；下一轮验证旧上传而非再次上传', async () => {
  const s = integration(); s.control.gatewayPending = true;
  assert.equal((await s.tick()).status, 200);
  assert.equal(s.uploads.length, 1);
  assert.equal(s.db.records.get('1')!.lease_expires_at, new Date(61_000).toISOString());
  assert.equal((await s.tick()).body.processed, 0);
  s.control.advance(61_000); s.control.gatewayPending = false;
  assert.equal((await s.tick()).status, 200);
  assert.equal(s.db.records.get('1')!.status, 'success');
  assert.equal(s.uploads.length, 2);
});

test('真实上传成功但结果未落库时进入复核，下一次调用不会重复付费上传', async () => {
  const s = integration(); s.control.uploadWriteLost = true;
  assert.equal((await s.tick()).status, 500);
  assert.equal(s.db.records.get('1')!.status, 'failed');
  assert.equal(Reflect.get(s.db.records.get('1')!, 'failure_kind'), 'manual_review');
  s.control.advance(360_000); s.control.uploadWriteLost = false;
  await s.tick();
  assert.equal(s.uploads.length, 1);
  assert.equal(s.sends.length, 0);
});

test('真实发送后回执未到，先保存 hash；下一轮只查回执，不重新发铸造交易', async () => {
  const s = integration(); s.control.receiptPending = true;
  assert.equal((await s.tick()).status, 200);
  assert.ok(s.db.records.get('1')!.tx_hash);
  assert.deepEqual(s.sends, ['mintScore']);
  await s.tick(); assert.deepEqual(s.sends, ['mintScore']);
  s.control.receiptPending = false; s.control.advance(60_000);
  assert.equal((await s.tick()).status, 200);
  assert.deepEqual(s.sends, ['mintScore', 'setTokenURI']);
});

test('真实广播响应丢失保留发送戳，下一轮不能盲发，十分钟后进入复核', async () => {
  const s = integration(); s.control.rpcReplyLost = true;
  assert.equal((await s.tick()).status, 500);
  assert.ok(s.db.records.get('1')!.mint_attempted_at);
  assert.equal(s.db.records.get('1')!.tx_hash, null);
  s.control.rpcReplyLost = false; s.control.advance(60_000);
  assert.equal((await s.tick()).status, 200);
  assert.deepEqual(s.sends, ['mintScore']);
  s.control.advance(600_000);
  assert.equal((await s.tick()).status, 500);
  assert.equal(Reflect.get(s.db.records.get('1')!, 'failure_kind'), 'manual_review');
  assert.deepEqual(s.sends, ['mintScore']);
});

test('步骤已写入而最新行读取失败，下一轮用已落库状态继续，不重复上传', async () => {
  const s = integration(); s.control.readLost = true;
  assert.equal((await s.tick()).status, 500);
  assert.equal(s.uploads.length, 1);
  s.control.readLost = false;
  assert.equal((await s.tick()).status, 200);
  assert.equal(s.db.records.get('1')!.status, 'success');
  assert.equal(s.uploads.length, 2);
});
