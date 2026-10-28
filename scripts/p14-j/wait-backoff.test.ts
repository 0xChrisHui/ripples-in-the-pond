import assert from 'node:assert/strict';
import { isPermanentWaitExpired, permanentWaitDelayMs, scoreQueueErrorDecision, PermanentResourcePendingError } from '../../src/lib/permanent-core/permanent-wait';

const limit = 2 * 60 * 60_000;
assert.equal(permanentWaitDelayMs(0), 60_000);
assert.equal(permanentWaitDelayMs(-1), 60_000);
assert.equal(permanentWaitDelayMs(120_000), 60_000);
assert.equal(permanentWaitDelayMs(240_000), 120_000);
assert.equal(permanentWaitDelayMs(30 * 60_000), 15 * 60_000);
assert.equal(permanentWaitDelayMs(limit * 2), 15 * 60_000);
let previous = 0;
for (let age = 0; age <= limit * 2; age += 1_000) {
  const delay = permanentWaitDelayMs(age);
  assert.ok(delay >= previous && delay >= 60_000 && delay <= 15 * 60_000);
  previous = delay;
}
assert.equal(isPermanentWaitExpired(limit - 1), false);
assert.equal(isPermanentWaitExpired(limit), true);
assert.equal(isPermanentWaitExpired(limit + 1), true);
assert.equal(isPermanentWaitExpired(Number.NaN), true);
const nowMs = Date.UTC(2026, 9, 28, 12);
const pending = new PermanentResourcePendingError('永久资源未达到双网关 quorum：尚未传播');
for (const age of [limit, limit + 1]) {
  const result = scoreQueueErrorDecision(pending, {
    retry_count: 0, created_at: new Date(nowMs - age).toISOString(),
  }, nowMs);
  assert.equal(result.waiting, false);
  assert.equal(result.update.retry_count, 1);
}
console.log('通过');
