import assert from 'node:assert/strict';
import { createPersonalEchoPoll } from '@/src/hooks/echo/personal-echo-poll';
import type { FeaturedEcho, PersonalEchoHomeResponse } from '@/src/types/featured-echo';
import { echo } from '@/scripts/p14-i/echo-fixtures';

const empty: PersonalEchoHomeResponse = { echo: null, pending: false };
const ready: PersonalEchoHomeResponse = { echo, pending: false };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function setup(query: () => Promise<PersonalEchoHomeResponse> = async () => empty) {
  let time = 0, timerId = 0, visible = true;
  const requests: number[] = [], outputs: (FeaturedEcho | null)[] = [];
  const timers = new Map<number, { at: number; fn: () => void }>();
  const poll = createPersonalEchoPoll({
    query: () => { requests.push(time); return query(); },
    onEcho: (value) => outputs.push(value), onError: (error) => { throw error; },
    isVisible: () => visible, now: () => time,
    setTimer: (fn, ms) => { timers.set(++timerId, { at: time + ms, fn }); return timerId; },
    clearTimer: (handle) => { timers.delete(handle as number); },
    createAbortController: () => new AbortController(),
  });
  async function advance(ms: number) {
    const target = time + ms;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      time = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
    }
    time = target; await flush();
  }
  return { poll, timers, requests, outputs, advance, hide: () => { visible = false; },
    show: () => { visible = true; } };
}

async function main() {
  { // 唯一一次聚焦落在冷却期，也要在 t=30 秒补查并发现新 Echo。
    let response = empty;
    const h = setup(async () => response);
    h.poll.start(); await flush(); await h.advance(10_000);
    response = ready; h.poll.recheck();
    assert.equal(h.timers.size, 1, '冷却期唤醒必须留下补查定时器');
    await h.advance(19_999); assert.deepEqual(h.requests, [0]);
    await h.advance(1); assert.deepEqual(h.requests, [0, 30_000]);
    assert.equal(h.outputs.at(-1), echo); assert.equal(h.timers.size, 0);
    h.poll.recheck(); await h.advance(570_000);
    assert.deepEqual(h.requests, [0, 30_000]); assert.equal(h.timers.size, 0);
  }
  { // 连续唤醒合并，补查时刻不能被后续聚焦推迟。
    const h = setup(); h.poll.start(); await flush();
    for (const ms of [10_000, 5_000, 14_999]) {
      await h.advance(ms); h.poll.recheck();
      assert.equal(h.timers.size, 1);
      assert.equal([...h.timers.values()][0].at, 30_000);
    }
    await h.advance(1); assert.deepEqual(h.requests, [0, 30_000]);
    await h.advance(570_000); assert.equal(h.timers.size, 0);
    assert.deepEqual(h.requests, [0, 30_000]); h.poll.stop();
  }
  { // 到点不可见则放弃，恢复可见后的新唤醒仍可查询。
    const h = setup(); h.poll.start(); await flush(); await h.advance(10_000);
    h.poll.recheck(); h.hide(); await h.advance(590_000);
    assert.deepEqual(h.requests, [0]); assert.equal(h.timers.size, 0);
    h.poll.recheck(); await flush(); assert.deepEqual(h.requests, [0]);
    h.show(); h.poll.recheck(); await flush();
    assert.deepEqual(h.requests, [0, 600_000]); h.poll.stop();
  }
  { // stop 清理补查；即使旧回调迟到也不能再发请求。
    const h = setup(); h.poll.start(); await flush(); await h.advance(10_000);
    h.poll.recheck(); const stale = [...h.timers.values()][0].fn;
    h.poll.stop(); assert.equal(h.timers.size, 0);
    stale(); h.poll.recheck(); await h.advance(590_000);
    assert.deepEqual(h.requests, [0]); assert.deepEqual(h.outputs, [null]);
  }
  { // 慢首查按请求开始计时，响应后只补剩余的 1 秒。
    let resolve!: (value: PersonalEchoHomeResponse) => void;
    const waiting = new Promise<PersonalEchoHomeResponse>((yes) => { resolve = yes; });
    let calls = 0;
    const h = setup(() => ++calls === 1 ? waiting : Promise.resolve(empty));
    h.poll.start(); await h.advance(29_000); resolve(empty); await flush();
    h.poll.recheck(); await h.advance(999); assert.deepEqual(h.requests, [0]);
    await h.advance(1); assert.deepEqual(h.requests, [0, 30_000]); h.poll.stop();
  }
  { // 补查返回 pending 后恢复正常轮询节奏，聚焦仍可立即复查。
    let calls = 0;
    const h = setup(async () => ++calls === 1 ? empty : { echo: null, pending: true });
    h.poll.start(); await flush(); await h.advance(10_000); h.poll.recheck();
    await h.advance(20_000); assert.equal(h.poll.polling, true);
    await h.advance(5_000); h.poll.recheck(); await flush();
    assert.deepEqual(h.requests, [0, 30_000, 35_000]);
    await h.advance(30_000); assert.deepEqual(h.requests, [0, 30_000, 35_000, 65_000]);
    assert.equal(h.timers.size, 1); h.poll.stop();
  }
  console.log('个人 Echo 冷却补查测试通过（6 组）');
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
