import assert from 'node:assert/strict';
import test from 'node:test';
import { safeBroadcast, type BroadcastServices, type Marker } from '../../src/lib/chain/broadcast/protocol';

function setup() {
  let mark: Marker | null = null;
  let now = 1000;
  const calls: string[] = [];
  const deps: BroadcastServices = {
    now: () => now, renew: async () => true,
    read: async () => mark, write: async value => { mark = value; },
    confirmed: async () => false, nonceClear: async () => true,
    wait: async () => { calls.push('wait'); }, alarm: async () => { calls.push('alarm'); },
  };
  const job = { stamp: async () => { calls.push('stamp'); return true; },
    unstamp: async () => { calls.push('unstamp'); },
    send: async (guard: (hash: `0x${string}`) => Promise<void>) => { await guard('0x01'); calls.push('send'); return '0x01' as const; },
    save: async () => { calls.push('save'); } };
  const run = (ms = 25_000) => safeBroadcast(deps, job, now + ms);
  return { deps, job, calls, run, advance: (ms: number) => { now += ms; } };
}

test('交易哈希先保存，回执未到时阻止下一笔，十五分钟发告警', async () => {
  const s = setup();
  assert.equal(await s.run(), 'sent');
  assert.deepEqual(s.calls, ['stamp', 'send', 'save', 'wait']);
  assert.equal(await s.run(), 'blocked');
  s.advance(16 * 60_000);
  assert.equal(await s.run(), 'blocked');
  assert.equal(s.calls.at(-1), 'alarm');
  s.deps.confirmed = async () => true;
  assert.equal(await s.run(), 'sent');
});
test('广播异常后跨调用保存未知，冷却后仍需 nonce 对齐', async () => {
  const s = setup();
  s.job.send = async guard => { await guard('0x01'); throw Error('RPC 中断'); };
  await assert.rejects(s.run());
  assert.equal(await s.run(), 'blocked');
  s.advance(181_000);
  s.deps.confirmed = async () => true;
  s.deps.nonceClear = async () => false;
  assert.equal(await s.run(), 'blocked');
  assert.deepEqual(s.calls, ['stamp']);
});
test('预算、锁、nonce 或打戳失败时不发送', async () => {
  for (const reason of ['预算', '锁', 'nonce', '打戳']) {
    const s = setup();
    if (reason === '锁') s.deps.renew = async () => false;
    if (reason === 'nonce') s.deps.nonceClear = async () => false;
    if (reason === '打戳') s.job.stamp = async () => false;
    assert.notEqual(await s.run(reason === '预算' ? 8000 : 25000), 'sent');
    assert.deepEqual(s.calls, []);
  }
});
test('订单存 hash 失败也等待，保留钱包阻断；等待超时可以返回', async () => {
  const s = setup();
  s.job.save = async () => { throw Error('数据库失联'); };
  await assert.rejects(s.run(), /数据库/);
  assert.equal(s.calls.at(-1), 'wait');
  assert.equal(await s.run(), 'blocked');
  const t = setup();
  t.deps.wait = async () => { throw Error('超时'); };
  assert.equal(await t.run(), 'sent');
});

test('预发送检查后剩余预算不足时，撤销本轮戳，不把订单送人工', async () => {
  const s = setup();
  let stamped = false;
  Object.assign(s.job, {
    stamp: async () => { stamped = true; s.advance(11_000); return true; },
    unstamp: async () => { stamped = false; },
  });
  assert.equal(await s.run(), 'blocked');
  assert.equal(stamped, false);
  assert.ok(!s.calls.includes('send'));
});
test('慢速准备超过锁租期时，实际广播边界拒绝迟到的交易', async () => {
  const s = setup();
  let rawSent = false;
  Object.assign(s.job, { send: async (guard: (hash: `0x${string}`) => Promise<void>) => {
    s.advance(121_000);
    await guard('0x01');
    rawSent = true;
    return '0x01';
  }});
  assert.equal(await s.run(), 'blocked');
  assert.equal(rawSent, false);
});
