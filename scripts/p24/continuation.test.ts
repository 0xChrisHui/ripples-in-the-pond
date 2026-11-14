import test from 'node:test';
import assert from 'node:assert/strict';
import { runScoreCycle, type ScoreLease } from '../../src/lib/cron/score-cycle';
import { scoreRow, memoryDb } from './continuation/fixture';

function setup(count = 5) {
  let time = 1000;
  const db = memoryDb(Array.from({ length: count }, (_, i) => scoreRow(String(i + 1))), () => time);
  const calls: string[] = [];
  const released: string[] = [];
  const options = {
    limit: 5, concurrency: 3, claimUntil: 21_000, deadline: 26_000, now: () => time,
    claim: async () => db.claim(),
    step: async ({ row }: ScoreLease) => {
      calls.push(row.id);
      const stored = db.records.get(row.id)!;
      assert.equal(stored.events_upload_state, row.events_upload_state, '继续前必须读取最新行');
      if (row.events_upload_state === 'none') stored.events_upload_state = 'uploaded';
      else stored.status = 'success';
      return { result: 'ok', status: stored.status };
    },
    reload: async ({ row, leaseOwner }: ScoreLease) => {
      const current = db.records.get(row.id)!;
      return current.locked_by === leaseOwner ? { ...current } : null;
    },
    release: async ({ row, leaseOwner }: ScoreLease) => {
      const current = db.records.get(row.id)!;
      if (current.locked_by === leaseOwner) {
        current.locked_by = null; current.lease_expires_at = null; released.push(row.id);
      }
    },
  };
  return { db, calls, released, options, advance: (ms: number) => { time += ms; } };
}

test('五单轮转后继续，状态名相同但上传已落库也能推进，租约到终止才释放', async () => {
  const s = setup();
  const result = await runScoreCycle(s.options);
  assert.deepEqual(s.calls, ['1', '2', '3', '4', '5', '1', '2', '3', '4', '5']);
  assert.equal(result.results.length, 5);
  assert.equal(s.released.length, 5);
  assert.ok([...s.db.records.values()].every(row => row.status === 'success'));
});

test('无进展、传播退避和失败各自退出，不拖住其他正常单', async () => {
  const s = setup();
  const normal = s.options.step;
  s.options.step = async job => {
    if (job.row.id === '1') { s.calls.push('1'); return { result: 'ok', status: job.row.status }; }
    if (job.row.id === '2') {
      s.calls.push('2'); Object.assign(s.db.records.get('2')!, { locked_by: null, lease_expires_at: new Date(61_000).toISOString() });
      return { result: 'waiting', status: job.row.status };
    }
    if (job.row.id === '3') { s.calls.push('3'); throw Error('单单失败'); }
    return normal(job);
  };
  const result = await runScoreCycle(s.options);
  assert.equal(result.results.filter(r => r.status === 'rejected').length, 1);
  assert.equal(s.calls.filter(id => ['1', '2', '3'].includes(id)).length, 3);
  assert.equal(s.db.records.get('4')!.status, 'success');
  assert.equal(s.db.records.get('5')!.status, 'success');
  assert.equal(s.db.records.get('2')!.lease_expires_at, new Date(61_000).toISOString());
});

test('慢步骤越过预算后保存并退出，下次调用读取已有上传事实继续', async () => {
  const s = setup(1);
  const normal = s.options.step;
  s.options.step = async job => { const r = await normal(job); s.advance(26_000); return r; };
  await runScoreCycle(s.options);
  assert.deepEqual(s.calls, ['1']);
  assert.equal(s.db.records.get('1')!.events_upload_state, 'uploaded');
  s.options.step = normal; s.options.claimUntil = 50_000; s.options.deadline = 55_000;
  await runScoreCycle(s.options);
  assert.deepEqual(s.calls, ['1', '1']);
  assert.equal(s.db.records.get('1')!.status, 'success');
});

test('剩余不足五秒、读回失租约和读取失败均不再启动下一步', async () => {
  const budget = setup(); budget.advance(20_001);
  budget.options.claimUntil = 25_000;
  await runScoreCycle(budget.options);
  assert.deepEqual(budget.calls, []);
  assert.equal(budget.released.length, 5);
  for (const mode of ['lost', 'error']) {
    const s = setup(1);
    s.options.reload = async () => { if (mode === 'error') throw Error('读回失败'); return null; };
    const r = await runScoreCycle(s.options);
    assert.deepEqual(s.calls, ['1']);
    assert.equal(r.results[0].status, 'rejected');
  }
});

test('30 单在两轮重叠调用下均能完成，每步只执行一次且每单最多十二步', async () => {
  const s = setup(30);
  for (let tick = 0; tick < 3; tick++) await Promise.all([runScoreCycle(s.options), runScoreCycle(s.options)]);
  assert.equal(s.calls.length, 60);
  assert.equal(s.released.length, 30);
  assert.ok([...s.db.records.values()].every(row => row.status === 'success'));
  const runaway = setup(1);
  runaway.options.step = async ({ row }) => {
    runaway.calls.push(row.id);
    runaway.db.records.get(row.id)!.tx_hash = String(runaway.calls.length);
    return { result: 'ok', status: row.status };
  };
  await runScoreCycle(runaway.options);
  assert.equal(runaway.calls.length, 12);
});

test('一单仍在外部等待时，其他工作槽能完成后面的订单', async () => {
  const s = setup();
  const normal = s.options.step;
  let unblock!: () => void;
  const waiting = new Promise<void>(resolve => { unblock = resolve; });
  s.options.step = async job => {
    if (job.row.id === '1') await waiting;
    const result = await normal(job);
    if (job.row.id === '5' && result.status === 'success') unblock();
    return result;
  };
  await runScoreCycle(s.options);
  assert.ok(s.calls.indexOf('1') > s.calls.lastIndexOf('5'));
});

test('领取部分失败仍处理已领订单，释放失败被报告而非冒充成功', async () => {
  const s = setup(); let claims = 0;
  s.options.claim = async () => { if (++claims === 3) throw Error('领取失败'); return s.db.claim(); };
  s.options.release = async () => { throw Error('释放失败'); };
  const result = await runScoreCycle(s.options);
  assert.equal(result.claimFailed, true);
  assert.equal(result.results.length, 2);
  assert.ok(result.results.every(r => r.status === 'rejected'));
});

test('最新状态读取或释放失败时，日志包含订单号和原因，便于定位', async context => {
  const logger = context.mock.method(console, 'error', () => undefined);
  for (const phase of ['reload', 'release'] as const) {
    const s = setup(1);
    s.options[phase] = async () => { throw Error(`${phase}中断`); };
    await runScoreCycle(s.options);
    const args = logger.mock.calls.at(-1)?.arguments;
    assert.ok(args, '失败必须留下日志');
    assert.equal(args[1], '1');
    assert.match(String(args[2]), new RegExp(`${phase}中断`));
  }
});
