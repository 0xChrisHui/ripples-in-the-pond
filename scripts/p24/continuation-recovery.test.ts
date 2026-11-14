import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOfflineModule } from '../p14-j/offline-module';
import * as wait from '../../src/lib/permanent-core/permanent-wait';
import type { ScoreMintQueueRow, ScoreMintStatus } from '../../src/types/score-mint';
import { memoryDb, scoreRow } from './continuation/fixture';

function setup() {
  let time = 1000;
  const db = memoryDb([scoreRow()], () => time);
  const job = db.claim()!;
  const { processOrder } = loadOfflineModule<{
    processOrder(row: ScoreMintQueueRow, owner: string, step: () => Promise<ScoreMintStatus>, keepLease?: boolean): Promise<{ result: string }>;
  }>('app/api/cron/process-score-queue/process-order.ts', {
    '@/src/lib/supabase': { supabaseAdmin: db }, '@/src/lib/alerts/once': { notifyOnce: async () => true },
    '@/src/lib/permanent-core/permanent-wait': wait,
  }, { Date: class extends Date { static now() { return time; } constructor(value?: string | number) { super(value ?? time); } }, console: { error() {} } });
  return { db, job, processOrder, advance(ms: number) { time += ms; } };
}

test('连续模式保存状态时持有原租约；默认模式仍释放租约', async () => {
  const s = setup();
  await s.processOrder(s.job.row, s.job.leaseOwner, async () => 'preparing_package', true);
  assert.equal(s.db.records.get('1')!.status, 'preparing_package');
  assert.equal(s.db.records.get('1')!.locked_by, s.job.leaseOwner);
  assert.equal(s.db.claim(), null);
  await s.processOrder(s.db.records.get('1')!, s.job.leaseOwner, async () => 'minting_onchain');
  assert.equal(s.db.records.get('1')!.locked_by, null);
});

test('硬中断后五分钟租约内不能重领，到期新 owner 续接，旧 owner 不能覆盖', async () => {
  const s = setup();
  await s.processOrder(s.job.row, s.job.leaseOwner, async () => 'preparing_package', true);
  s.advance(299_000); assert.equal(s.db.claim(), null);
  s.advance(1002); const next = s.db.claim()!;
  assert.equal(next.row.status, 'preparing_package');
  assert.notEqual(next.leaseOwner, s.job.leaseOwner);
  await assert.rejects(s.processOrder(s.job.row, s.job.leaseOwner, async () => 'success', true), /CAS/);
  assert.equal(s.db.records.get('1')!.status, 'preparing_package');
});

test('连续模式传播未就绪保留退避，未知上传进入复核，状态保存失败不报告成功', async () => {
  const pending = setup();
  const r = await pending.processOrder(pending.job.row, pending.job.leaseOwner,
    async () => { throw new wait.PermanentResourcePendingError('暂未同步'); }, true);
  assert.equal(r.result, 'waiting');
  assert.equal(pending.db.records.get('1')!.locked_by, null);
  assert.equal(pending.db.records.get('1')!.lease_expires_at, new Date(61_000).toISOString());
  const unknown = setup();
  await assert.rejects(unknown.processOrder(unknown.job.row, unknown.job.leaseOwner,
    async () => { throw Error('CRITICAL: 上传结果未知'); }, true));
  assert.equal(unknown.db.records.get('1')!.status, 'failed');
  assert.equal(Reflect.get(unknown.db.records.get('1')!, 'failure_kind'), 'manual_review');
  const broken = setup(); broken.db.failWrites(true);
  await assert.rejects(broken.processOrder(broken.job.row, broken.job.leaseOwner, async () => 'success', true), /CAS/);
});
