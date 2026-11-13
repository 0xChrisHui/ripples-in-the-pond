import test from 'node:test';
import assert from 'node:assert/strict';
import { runBatch, serialSender } from '../../src/lib/cron/batch';
import { queueHealth, heartbeatLate } from '../../src/lib/alerts/queue-health';
import { pollingDelay } from '../../src/hooks/score/polling-delay';

test('两轮交错领取独立订单，批内先领满再处理，失败不阻塞他人', async () => {
  const pending = new Set([1,2,3,4,5,6,7,8,9,10]);
  const seen: number[] = [];
  async function tick() {
    let claims = 0;
    return runBatch({ limit: 5, concurrency: 3, claimUntil: Date.now() + 20_000,
      claim: async () => {
        const id = [...pending][0];
        pending.delete(id);
        claims++;
        return id;
      },
      process: async id => {
        assert.equal(claims, 5);
        seen.push(id);
        if (id === 4) throw Error('单笔失败');
        return id;
      },
    });
  }
  const batches = await Promise.all([tick(), tick()]);
  assert.equal(new Set(seen).size, 10);
  assert.equal(batches.flatMap(b => b.results).filter(r => r.status === 'rejected').length, 1);
});
test('领取异常保留已领单，过截止时间不再领单', async () => {
  let count = 0;
  const options = { limit: 5, concurrency: 3, claimUntil: Date.now() + 1000,
    claim: async () => { if (count++) throw Error('模拟数据库故障'); return 1; }, process: async (id: number) => id };
  const batch = await runBatch(options);
  assert.equal(batch.claimFailed, true);
  assert.equal(batch.results.length, 1);
  assert.equal((await runBatch({ ...options, claimUntil: 0 })).results.length, 0);
});
test('串行钱包队列一笔抛错，后续继续且不重叠', async () => {
  const order: number[] = [];
  let running = 0;
  const send = serialSender();
  const results = await Promise.allSettled([1,2,3].map(n => send(async () => {
    assert.equal(running++, 0);
    await Promise.resolve();
    order.push(n); running--;
    if (n === 2) throw Error('拒绝');
  })));
  assert.deepEqual(order,[1,2,3]); assert.equal(results[2].status, 'fulfilled');
});
test('巡检区分调度、正常积压、长时间无人成功及个别老单', () => {
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60_000).toISOString();
  assert.deepEqual(queueHealth(ago(181),ago(5),now),{ noProgress: false, waitingTooLong: true });
  assert.equal(queueHealth(ago(90),ago(60),now).noProgress,true);
  assert.equal(queueHealth(ago(5),undefined,now).noProgress,false);
  assert.equal(heartbeatLate(1,ago(11),now),true);
  assert.equal(heartbeatLate(0,undefined,now),false);
});
test('轮询以最新活跃单为准，ETH 人工复核及过期订单不轮询', () => {
  const now = Date.now();
  const row = {status:'pending' as const,mintMode:'op_sponsored' as const,submittedAt:new Date(now-3_600_000).toISOString()};
  assert.equal(pollingDelay([row],now),300_000);
  assert.equal(pollingDelay([row,{...row,submittedAt:new Date(now).toISOString()}],now),120_000);
  assert.equal(pollingDelay([{...row,status:'manual_review',mintMode:'eth_self_paid'},{...row,status:'expired',mintMode:'eth_self_paid'}],now),0);
});
