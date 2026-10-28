import assert from 'node:assert/strict';
import { PermanentResourcePendingError, scoreQueueErrorDecision } from '../../src/lib/permanent-core/permanent-wait';

const nowMs = Date.UTC(2026, 9, 28, 12);
const iso = (ageMs: number) => new Date(nowMs - ageMs).toISOString();
const pending = new PermanentResourcePendingError('永久资源未达到双网关 quorum：网关\n尚未传播');
const oldRow = {
  retry_count: 2, created_at: iso(24 * 60 * 60_000), status: 'uploading_events',
  locked_by: 'worker', lease_expires_at: new Date(nowMs + 300_000).toISOString(),
};

// 注入固定时钟和账本时间，验证与 route 共用的决策及实际应用后的队列字段。
const waiting = scoreQueueErrorDecision(pending, oldRow, nowMs, iso(240_000));
assert.equal(waiting.waiting, true);
const after = { ...oldRow, ...waiting.update };
assert.equal(after.retry_count, 2);
assert.equal(after.status, oldRow.status);
assert.equal('status' in waiting.update, false);
assert.equal('retry_count' in waiting.update, false);
assert.equal('failure_kind' in waiting.update, false);
assert.equal(after.locked_by, null);
assert.equal(after.lease_expires_at, new Date(nowMs + 120_000).toISOString());
assert.equal(after.updated_at, new Date(nowMs).toISOString());
assert.ok(after.last_error && !after.last_error.includes('\n'));

const recent = { ...oldRow, retry_count: 0, created_at: iso(60_000) };
assert.equal(scoreQueueErrorDecision(pending, recent, nowMs).waiting, true);
const expired = scoreQueueErrorDecision(pending, recent, nowMs, iso(2 * 60 * 60_000));
assert.equal(expired.waiting, false);
assert.equal(expired.update.retry_count, 1);
assert.equal(expired.update.lease_expires_at, null);
const fallbackExpired = scoreQueueErrorDecision(pending, oldRow, nowMs);
assert.equal(fallbackExpired.waiting, false);
assert.equal(fallbackExpired.update.status, 'failed');
assert.equal(fallbackExpired.update.failure_kind, 'safe_retry');
assert.equal(scoreQueueErrorDecision(pending, { ...recent, created_at: '损坏时间' }, nowMs).waiting, false);

for (const error of [new Error('普通错误'), '非 Error 异常', new Error('永久资源未达到双网关 quorum：SHA-256 mismatch')]) {
  for (const retry of [0, 1, 2]) {
    const result = scoreQueueErrorDecision(error, { ...recent, retry_count: retry }, nowMs);
    assert.equal(result.waiting, false);
    assert.equal(result.update.retry_count, retry + 1);
    assert.equal(result.update.status, retry === 2 ? 'failed' : undefined);
    assert.equal(result.update.failure_kind, retry === 2 ? 'safe_retry' : undefined);
    assert.equal(result.update.locked_by, null);
    assert.equal(result.update.lease_expires_at, null);
  }
}
for (const retry of [0, 2]) {
  const result = scoreQueueErrorDecision(new Error('CRITICAL: 上传结果未知'), { ...recent, retry_count: retry }, nowMs);
  assert.equal(result.waiting, false);
  assert.equal(result.update.status, 'failed');
  assert.equal(result.update.failure_kind, 'manual_review');
  assert.equal(result.update.retry_count, retry);
  assert.equal(result.update.lease_expires_at, null);
}
const long = scoreQueueErrorDecision(new Error('错'.repeat(600)), recent, nowMs);
assert.equal(long.update.last_error?.length, 500);
assert.equal(scoreQueueErrorDecision(new Error('原始\n错误'), recent, nowMs).update.last_error, '原始\n错误');
const criticalPending = scoreQueueErrorDecision(new PermanentResourcePendingError('CRITICAL: 状态损坏'), recent, nowMs);
assert.equal(criticalPending.waiting, false);
assert.equal(criticalPending.update.failure_kind, 'manual_review');
console.log('通过');
