import assert from 'node:assert/strict';
import { createPersonalEchoPoll } from '@/src/hooks/echo/personal-echo-poll';
import type { FeaturedEcho, PersonalEchoHomeResponse } from '@/src/types/featured-echo';
import { echo } from '@/scripts/p14-i/echo-fixtures';

const pending: PersonalEchoHomeResponse = { echo: null, pending: true };
const empty: PersonalEchoHomeResponse = { echo: null, pending: false };
const ready: PersonalEchoHomeResponse = { echo, pending: false };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred() {
  let resolve!: (value: PersonalEchoHomeResponse) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<PersonalEchoHomeResponse>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(query: (signal: AbortSignal, count: number) => Promise<PersonalEchoHomeResponse>
  = async () => pending) {
  let time = 0, timerId = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const signals: AbortSignal[] = [], outputs: (FeaturedEcho | null)[] = [], errors: unknown[] = [];
  const visibility = { active: true, documentVisible: true };
  const poll = createPersonalEchoPoll({
    query: (signal) => { signals.push(signal); return query(signal, signals.length); },
    onEcho: (value) => outputs.push(value), onError: (error) => errors.push(error),
    isVisible: () => visibility.active && visibility.documentVisible, now: () => time,
    setTimer: (fn, ms) => { timers.set(++timerId, { at: time + ms, fn }); return timerId; },
    clearTimer: (handle) => { timers.delete(handle as number); },
    createAbortController: () => new AbortController(),
  });
  const advance = async (ms: number) => {
    const target = time + ms;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      time = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
    }
    time = target; await flush();
  };
  return { poll, timers, signals, outputs, errors, visibility, advance };
}

async function main() {
  { // a：首次 pending 后 30 秒复查，拿到 Echo 后永久停止。
    const h = setup(async (_signal, count) => count === 1 ? pending : ready);
    h.poll.start(); h.poll.start(); await flush();
    assert.equal(h.poll.polling, true);
    await h.advance(29_999); assert.equal(h.signals.length, 1);
    await h.advance(1); assert.equal(h.signals.length, 2);
    assert.equal(h.outputs.at(-1), echo); assert.equal(h.poll.polling, false);
    h.poll.recheck(); h.poll.start(); await h.advance(1_200_000);
    h.poll.recheck(); await flush();
    assert.equal(h.signals.length, 2); assert.equal(h.timers.size, 0);
  }
  { // b：t=0 首查，30…1170 秒共 39 次复查；1200 秒到期不查，总计 40 次。
    const h = setup(); h.poll.start(); await flush();
    await h.advance(1_199_999);
    assert.equal(h.signals.length, 40); assert.equal(h.poll.polling, true);
    await h.advance(1); assert.equal(h.poll.polling, false);
    assert.equal(h.timers.size, 0);
    await h.advance(1_200_000); assert.equal(h.signals.length, 40);
    h.poll.recheck(); await flush(); assert.equal(h.signals.length, 41);
    assert.equal(h.poll.polling, true); h.poll.stop();
  }
  { // c：浏览器与首页场景分别隐藏；恢复时补查，并从补查时刻重新计 30 秒。
    const h = setup(); h.poll.start(); await flush();
    h.visibility.documentVisible = false;
    await h.advance(45_000); h.poll.recheck(); assert.equal(h.signals.length, 1);
    h.visibility.documentVisible = true; h.visibility.active = false;
    h.poll.recheck(); await h.advance(30_000); assert.equal(h.signals.length, 1);
    h.visibility.active = true; h.poll.recheck(); h.poll.recheck(); await flush();
    assert.equal(h.signals.length, 2); assert.equal(h.timers.size, 1);
    await h.advance(29_999); assert.equal(h.signals.length, 2);
    await h.advance(1); assert.equal(h.signals.length, 3);
    assert.equal(h.timers.size, 1); h.poll.stop();
  }
  { // d：聚焦提前复查，原定时器取消；终止后聚焦不再查。
    const h = setup(async (_signal, count) => count === 3 ? ready : pending);
    h.poll.start(); await flush(); await h.advance(10_000);
    h.poll.recheck(); await flush(); assert.equal(h.signals.length, 2);
    await h.advance(20_000); assert.equal(h.signals.length, 2);
    await h.advance(10_000); assert.equal(h.signals.length, 3);
    h.poll.recheck(); await h.advance(60_000); assert.equal(h.signals.length, 3);
  }
  { // e：停止取消在途请求与期限计时器；迟到响应、旧回调都不能发布。
    const waiting = deferred();
    const h = setup(async (_signal, count) => count === 1 ? pending : waiting.promise);
    h.poll.start(); await flush(); await h.advance(30_000);
    const stale = [...h.timers.values()][0].fn, before = h.outputs.length;
    h.poll.stop(); assert.equal(h.signals[1].aborted, true);
    assert.equal(h.timers.size, 0); assert.equal(h.poll.polling, false);
    waiting.resolve(ready); await flush(); stale(); h.poll.recheck();
    await h.advance(1_200_000);
    assert.equal(h.outputs.length, before); assert.equal(h.signals.length, 2);
    const idle = setup(); idle.poll.start(); await flush(); idle.poll.stop();
    await idle.advance(60_000); idle.poll.recheck(); await flush(); assert.equal(idle.signals.length, 1);
    assert.equal(idle.timers.size, 0);
    const first = deferred(), initial = setup(() => first.promise);
    initial.poll.start(); initial.poll.stop(); first.reject(new Error('取消后的网络失败'));
    await flush(); assert.equal(initial.signals[0].aborted, true);
    assert.deepEqual(initial.outputs, []); assert.deepEqual(initial.errors, []);
    const never = setup(); never.poll.stop(); never.poll.start(); await never.advance(60_000);
    never.poll.recheck(); await flush(); assert.equal(never.signals.length, 0);
  }
  { // f：轮询中的网络错误或非 2xx 错误继续；首次失败只输出 null。
    const h = setup(async (_signal, count) => {
      if (count === 2) throw new Error('网络错误');
      if (count === 3) throw new Error('查询失败（状态码 503）');
      return count === 4 ? ready : pending;
    });
    h.poll.start(); await flush(); await h.advance(30_000);
    assert.equal(h.poll.polling, true); assert.equal(h.errors.length, 1);
    await h.advance(30_000); assert.equal(h.poll.polling, true);
    await h.advance(30_000); assert.equal(h.outputs.at(-1), echo);
    assert.equal(h.errors.length, 2); assert.equal(h.poll.polling, false);
    for (const message of ['网络错误', '查询失败（状态码 503）']) {
      const initial = setup(async (_signal, count) => { if (count === 1) throw new Error(message); return pending; });
      initial.poll.start(); await flush(); await initial.advance(60_000);
      assert.deepEqual(initial.outputs, [null]); assert.equal(initial.errors.length, 1);
      assert.equal(initial.poll.polling, false); assert.equal(initial.timers.size, 0);
      assert.equal(initial.signals.length, 1);
      initial.poll.recheck(); await flush(); assert.equal(initial.signals.length, 2);
      assert.equal(initial.poll.polling, true); initial.poll.stop();
    }
  }
  { // g：无 Echo 本轮结束；冷却内多次唤醒合并为一次延后补查，隐藏不查，不并发。
    for (const pendingFirst of [false, true]) {
      const h = setup(async (_signal, count) => pendingFirst && count === 1 ? pending : empty);
      h.poll.start(); await flush(); await h.advance(pendingFirst ? 30_000 : 0);
      assert.equal(h.poll.polling, false); assert.equal(h.outputs.at(-1), null);
      const before = h.signals.length;
      h.poll.recheck(); await h.advance(29_999); h.poll.recheck(); await flush();
      assert.equal(h.signals.length, before); assert.equal(h.timers.size, 1);
      await h.advance(1); assert.equal(h.signals.length, before + 1); assert.equal(h.timers.size, 0);
      await h.advance(30_000); h.visibility.active = false; h.poll.recheck();
      h.visibility.active = true; h.visibility.documentVisible = false; h.poll.recheck();
      await flush(); assert.equal(h.signals.length, before + 1); assert.equal(h.timers.size, 0);
      h.visibility.documentVisible = true; h.poll.recheck(); h.poll.recheck(); await flush();
      assert.equal(h.signals.length, before + 2); assert.equal(h.timers.size, 0);
      h.poll.stop(); await h.advance(30_000); h.poll.recheck(); await flush();
      assert.equal(h.signals.length, before + 2);
    }
    const h = setup(async () => ({ echo, pending: true }));
    h.poll.start(); await flush(); assert.equal(h.outputs[0], echo);
    assert.equal(h.poll.polling, false); assert.equal(h.timers.size, 0);
    await h.advance(30_000); h.poll.recheck(); await flush(); assert.equal(h.signals.length, 1);
  }
  { // h：首查与复查在途时重复聚焦均不并发；慢响应不推迟聚焦后的下一轮。
    const first = deferred(), next = deferred();
    const h = setup((_signal, count) => count === 1 ? first.promise : count === 2 ? next.promise : Promise.resolve(pending));
    h.poll.start(); h.poll.recheck(); assert.equal(h.signals.length, 1);
    first.resolve(pending); await flush(); await h.advance(5_000);
    h.poll.recheck(); h.poll.recheck(); assert.equal(h.signals.length, 2);
    await h.advance(10_000); h.poll.recheck(); assert.equal(h.signals.length, 2);
    next.resolve(pending); await flush(); await h.advance(19_999);
    assert.equal(h.signals.length, 2); await h.advance(1);
    assert.equal(h.signals.length, 3); assert.equal(h.timers.size, 1); h.poll.stop();
  }
  { // 绝对期限覆盖后台等待、在途挂起和持续失败，不被聚焦重置。
    const h = setup(); h.poll.start(); await flush(); h.visibility.active = false;
    await h.advance(1_200_000); h.visibility.active = true;
    assert.equal(h.signals.length, 1); assert.equal(h.poll.polling, false);
    h.poll.recheck(); await flush(); assert.equal(h.signals.length, 2); h.poll.stop();
    const waiting = deferred();
    const slow = setup((_signal, count) => count === 2 ? waiting.promise : Promise.resolve(pending));
    slow.poll.start(); await flush(); await slow.advance(1_199_999);
    assert.equal(slow.poll.polling, true); slow.poll.recheck();
    await slow.advance(1); assert.equal(slow.signals[1].aborted, true);
    assert.equal(slow.poll.polling, false);
    slow.poll.recheck(); await flush(); assert.equal(slow.signals.length, 3);
    const before = slow.outputs.length;
    waiting.resolve(ready); await flush(); assert.equal(slow.outputs.length, before);
    await slow.advance(29_999); assert.equal(slow.signals.length, 3); await slow.advance(1); assert.equal(slow.signals.length, 4);
    assert.equal(slow.poll.polling, true); assert.equal(slow.timers.size, 1); slow.poll.stop();
    const failing = setup(async (_signal, count) => {
      if (count > 1) throw new Error('持续网络错误');
      return pending;
    });
    failing.poll.start(); await flush(); await failing.advance(1_200_000);
    assert.equal(failing.signals.length, 40); assert.equal(failing.poll.polling, false);
    assert.equal(failing.timers.size, 0); assert.equal(failing.errors.length, 39);
  }
  { // 唤醒后 pending 开启新的 30 秒节奏和 20 分钟期限，不沿用旧轮次。
    const h = setup(async (_signal, count) => count === 1 ? empty : pending);
    h.poll.start(); await flush(); await h.advance(600_000);
    h.poll.recheck(); await flush(); assert.equal(h.signals.length, 2);
    assert.equal(h.poll.polling, true); assert.equal(h.timers.size, 1);
    await h.advance(29_999); assert.equal(h.signals.length, 2);
    await h.advance(1); assert.equal(h.signals.length, 3);
    await h.advance(1_169_999); assert.equal(h.signals.length, 41); assert.equal(h.poll.polling, true);
    await h.advance(1); assert.equal(h.poll.polling, false); assert.equal(h.timers.size, 0);
  }
  { // 冷却从请求开始计：慢首查返回后的唤醒在“请求开始 +30 秒”补查，不另等 30 秒。
    const waiting = deferred(), h = setup((_signal, count) => count === 1 ? waiting.promise : Promise.resolve(empty));
    h.poll.start(); await h.advance(29_999); waiting.resolve(empty); await flush();
    h.poll.recheck(); await flush(); assert.equal(h.signals.length, 1); assert.equal(h.timers.size, 1);
    await h.advance(1); await flush(); assert.equal(h.signals.length, 2); h.poll.stop();
  }
  console.log('通过');
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
