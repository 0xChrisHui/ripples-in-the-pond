import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './runtime';

test('真实步骤先预留、上传并验收，最终一笔交易完成铸造与 URI', async () => {
  const s = await runtime();
  assert.equal(await s.tick(), 'uploading_metadata');
  assert.equal(s.current().token_id, null);
  assert.equal(s.current().expected_token_id, 12);
  await s.tick(); await s.tick();
  assert.equal(s.current().status, 'minting_onchain');
  assert.equal(s.current().metadata_upload_state, 'verified');
  assert.equal(s.control.broadcasts, 0);
  assert.equal(Reflect.get(s.uploads[0], 'name'), 'Ripples #12');
  await s.tick(); assert.ok(s.current().atomic_ready_at);
  await s.tick(); assert.equal(s.control.broadcasts, 1);
  assert.equal(await s.tick(), 'setting_uri');
  assert.equal(s.current().token_id, 12);
  assert.equal(s.current().uri_tx_hash, s.current().tx_hash);
  assert.equal(s.uploads.length, 1);
});
test('另一订单持有编号时正常等待，不上传、不发送、不改编号', async () => {
  const s = await runtime(); s.control.conflict = true;
  assert.equal(await s.tick(), 'minting_onchain');
  assert.equal(s.current().expected_token_id, undefined);
  assert.equal(s.current().retry_count, 0); assert.equal(s.uploads.length, 0);
});
test('arweave.net 未就绪时绝不广播；恢复后复用同一份资料', async () => {
  const s = await runtime(); await s.tick(); await s.tick(); await s.tick();
  s.control.ready = false;
  await assert.rejects(s.tick(), /arweave.net 404/);
  assert.equal(s.control.broadcasts, 0); assert.equal(s.current().atomic_ready_at, undefined);
  s.control.ready = true; await s.tick(); await s.tick();
  assert.equal(s.control.broadcasts, 1); assert.equal(s.uploads.length, 1);
});
test('RPC 响应丢失仍保存确定哈希，恢复只确认一次原子交易', async () => {
  const s = await runtime(); for (let i = 0; i < 4; i++) await s.tick();
  s.control.replyLost = true; await assert.rejects(s.tick(), /RPC 返回丢失/);
  assert.ok(s.current().tx_hash);
  s.control.receiptPending = true; assert.equal(await s.tick(), 'minting_onchain');
  s.control.receiptPending = false; assert.equal(await s.tick(), 'setting_uri');
  assert.equal(s.control.broadcasts, 1);
});
test('预算不足不发交易；验收过期必须重新验证', async () => {
  const s = await runtime(); for (let i = 0; i < 4; i++) await s.tick();
  await s.tick(5_000); assert.equal(s.control.broadcasts, 0);
  s.control.advance(300_001); s.control.ready = false;
  await assert.rejects(s.tick(), /404/); assert.equal(s.control.broadcasts, 0);
});
test('已冻结订单不受环境入口更换影响', async () => {
  const s = await runtime(); await s.tick();
  s.globals.process.env.ATOMIC_SCORE_ISSUER_ADDRESS = '';
  for (let i = 0; i < 5; i++) await s.tick();
  assert.equal(s.current().status, 'setting_uri'); assert.equal(s.control.simulateCount, 1);
});
for (const flag of ['revert', 'wrongUri', 'wrongId'] as const) test(`链上 ${flag} 必须停止并保留编号`, async () => {
  const s = await runtime(); for (let i = 0; i < 5; i++) await s.tick();
  s.control[flag] = true; await assert.rejects(s.tick(), /CRITICAL/);
  assert.equal(s.current().token_id, null); assert.equal(s.current().expected_token_id, 12);
  assert.equal(s.control.broadcasts, 1);
});
test('发送戳存在而哈希缺失时不重发，超时转人工复核', async () => {
  const s = await runtime(); s.current().mint_attempted_at = new Date(1000).toISOString();
  await s.tick(); assert.equal(s.control.broadcasts, 0);
  s.control.advance(600_001); await assert.rejects(s.tick(), /CRITICAL/);
});
test('签名哈希落库失败时不允许原始交易发出', async () => {
  const s = await runtime(); for (let i = 0; i < 4; i++) await s.tick();
  s.control.failHashWrite = true; await assert.rejects(s.tick());
  assert.equal(s.control.broadcasts, 0);
  assert.equal(s.walletMarker(), null);
});
test('签名过程中验收过期，暂停并释放发送戳，不污染全钱包标记', async () => {
  const s = await runtime(); for (let i = 0; i < 4; i++) await s.tick();
  s.control.advance(250_000); s.control.signingDelay = 50_001;
  await s.tick(); assert.equal(s.control.broadcasts, 0);
  assert.equal(s.current().mint_attempted_at, null); assert.equal(s.current().tx_hash, null);
  assert.equal(s.walletMarker(), null);
  s.control.signingDelay = 0; await s.tick(); await s.tick();
  assert.equal(s.control.readinessChecks, 2); assert.equal(s.control.broadcasts, 1);
});
test('验收有效期须覆盖本轮截止时间，给保存哈希与锁检查留出预算', async () => {
  const s = await runtime(); for (let i = 0; i < 4; i++) await s.tick();
  s.control.advance(299_000); await s.tick();
  assert.equal(s.control.readinessChecks, 2); assert.equal(s.control.broadcasts, 0);
});
