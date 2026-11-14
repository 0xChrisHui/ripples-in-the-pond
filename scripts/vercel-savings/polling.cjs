const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const test = require('node:test');
const { load } = require('../p23/regressions/load.cjs');
const { hooks } = require('./hook-harness.cjs');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function setup(t, refresh) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const view = new EventTarget(); view.hidden = false;
  const globals = { setTimeout, clearTimeout, setInterval, clearInterval, Date };
  const file = 'src/lib/performance/visible-poll.ts';
  const helper = existsSync(file) ? load(file, {}, globals) : {};
  const { startLifecyclePolling } = load('src/hooks/score/useScoreLifecyclePolling.ts', {
    react: {}, 'next/navigation': {}, '@/src/lib/performance/visible-poll': helper,
  }, globals);
  const stop = startLifecyclePolling(refresh, view);
  t.after(stop);
  return { view, stop, tick: async ms => { t.mock.timers.tick(ms); await flush(); } };
}

test('制作查询按10/20/30秒退避，长时间等待最多每30秒一次', async t => {
  let calls = 0; const h = setup(t, () => { calls++; });
  await h.tick(10_000); assert.equal(calls, 1);
  await h.tick(19_999); assert.equal(calls, 1);
  await h.tick(1); assert.equal(calls, 2);
  await h.tick(30_000); assert.equal(calls, 3);
});
test('慢请求未返回时不会再次发起查询', async t => {
  let calls = 0, finish;
  const h = setup(t, () => { calls++; return new Promise(r => { finish = r; }); });
  await h.tick(10_000); await h.tick(120_000); assert.equal(calls, 1);
  finish(); await flush(); await h.tick(20_000); assert.equal(calls, 2);
});
test('隐藏暂停，恢复可见立即补查，重复可见事件不并发', async t => {
  let calls = 0, finish;
  const h = setup(t, () => { calls++; return new Promise(r => { finish = r; }); });
  h.view.hidden = true; h.view.dispatchEvent(new Event('visibilitychange'));
  await h.tick(60_000); assert.equal(calls, 0);
  h.view.hidden = false; h.view.dispatchEvent(new Event('visibilitychange'));
  h.view.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(calls, 1);
  h.stop(); finish(); await flush(); await h.tick(60_000); assert.equal(calls, 1);
});
test('真实Hook在Next路由刷新未完成时不再次refresh', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const h = hooks(), view = new EventTarget(); view.hidden = false;
  let pending = false, calls = 0;
  const transition = work => { pending = true; work(); };
  h.react.useTransition = () => [pending, transition];
  const globals = { setTimeout, clearTimeout, setInterval, clearInterval, Date, document: view };
  const helper = load('src/lib/performance/visible-poll.ts', {}, globals);
  const router = { refresh: () => { calls++; } };
  const { useScoreLifecyclePolling } = load('src/hooks/score/useScoreLifecyclePolling.ts', {
    react: h.react, 'next/navigation': { useRouter: () => router }, '@/src/lib/performance/visible-poll': helper,
  }, globals);
  const render = () => h.render(() => useScoreLifecyclePolling(true));
  render(); t.after(h.unmount);
  t.mock.timers.tick(10_000); await flush(); render();
  t.mock.timers.tick(20_000); await flush(); assert.equal(calls, 1);
  pending = false; render(); t.mock.timers.tick(30_000); await flush(); assert.equal(calls, 2);
});
