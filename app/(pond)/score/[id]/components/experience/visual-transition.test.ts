import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScoreVisualTransition, scoreVisualPresence, SCORE_ENTER_MS, SCORE_EXIT_MS } from './visual-transition';

function setup() {
  const jobs: Array<{ callback: () => void; ms: number; cancelled: boolean }> = [];
  const transition = createScoreVisualTransition({
    later(callback, ms) { const job = { callback, ms, cancelled: false }; jobs.push(job); return job; },
    cancel(handle) { if (handle) (handle as typeof jobs[number]).cancelled = true; },
  });
  return { transition, jobs };
}

test('自然结束与暂停都走独立退场，超时和 opacity 完成均清理展示', () => {
  for (const event of ['ended', 'paused', 'error', 'seek-ended']) {
    const { transition, jobs } = setup();
    transition.setPlaying(true);
    assert.equal(transition.getSnapshot(), 'entering', event);
    assert.equal(jobs[0].ms, SCORE_ENTER_MS + 80);
    jobs[0].callback();
    assert.equal(transition.getSnapshot(), 'active');
    transition.setPlaying(false);
    assert.equal(transition.getSnapshot(), 'exiting');
    assert.equal(jobs[1].ms, SCORE_EXIT_MS + 80);
    if (event === 'paused') transition.onOpacityEnd('exiting');
    else jobs[1].callback();
    assert.equal(transition.getSnapshot(), 'idle');
  }
});

test('退出中重播忽略旧超时与旧完成事件，卸载取消现有回调', () => {
  const { transition, jobs } = setup();
  transition.setPlaying(true);
  jobs[0].callback();
  transition.setPlaying(false);
  const stale = jobs[1];
  transition.setPlaying(true);
  assert.equal(stale.cancelled, true);
  stale.callback();
  transition.onOpacityEnd('exiting');
  assert.equal(transition.getSnapshot(), 'entering');
  transition.onOpacityEnd('entering');
  assert.equal(transition.getSnapshot(), 'active');
  transition.setPlaying(false);
  const last = jobs.at(-1)!;
  transition.dispose();
  last.callback();
  transition.onOpacityEnd('idle');
  assert.equal(transition.getSnapshot(), 'idle');
});

test('暂停 seek 不会重新进入，reduced-motion 可在过渡中立即落稳', () => {
  const { transition, jobs } = setup();
  transition.setPlaying(true);
  transition.setPlaying(true, true);
  assert.equal(transition.getSnapshot(), 'active');
  assert.equal(jobs[0].cancelled, true);
  transition.setPlaying(false);
  transition.setPlaying(false, true);
  assert.equal(transition.getSnapshot(), 'idle');
  transition.setPlaying(false);
  assert.equal(transition.getSnapshot(), 'idle');
  transition.setPlaying(true, true);
  assert.equal(transition.getSnapshot(), 'active');
  assert.equal(transition.getDurationMs(), 0);
});

test('球体显示从当前值连续反向，并在本轮退场时间内归零', () => {
  const half = scoreVisualPresence(0, 1, 225, 450);
  assert.ok(half > 0 && half < 1);
  assert.equal(scoreVisualPresence(half, 0, 0, 650), half);
  assert.equal(scoreVisualPresence(half, 0, 650, 650), 0);
  assert.equal(scoreVisualPresence(half, 1, 0, 450), half);
  assert.equal(scoreVisualPresence(half, 1, 450, 450), 1);
  assert.equal(scoreVisualPresence(half, 0, 0, 0), 0);
});
