import assert from 'node:assert/strict';
import { createPresence, leavePresence, stepPresence } from '@/src/components/pond-gl-test3/special36/depth-presence';
import { SPECIAL36_HIT_MIN } from '@/src/components/pond-gl-test3/special36/special36-step';

// 防止入场首帧可点击、被 held 跳过，或尚未完成就进入原随机隐现。
const entering = createPresence(true);
assert.equal(entering.value, 0);
let previous = 0;
let hitAt = 0;
for (let frame = 1; frame <= 150; frame++) {
  const events = stepPresence(entering, 0.01, true, 1);
  assert.ok(entering.value >= previous && entering.value <= 1, '入场必须单调且不超出 0..1');
  assert.deepEqual(events, { sink: false, relocate: false });
  if (!hitAt && entering.value >= SPECIAL36_HIT_MIN) hitAt = frame / 100;
  if (frame < 150) assert.equal(entering.phase, 'arriving');
  previous = entering.value;
}
assert.ok(hitAt >= 0.5 && hitAt <= 0.9, '入场前段必须低于命中阈值');
assert.equal(entering.value, 1);
assert.equal(entering.phase, 'visible');
assert.equal(entering.elapsed, 0, '入场结束才开始原可见期计时');

// 首次可见期沿用 8–45 秒且不乘 mood；后续自然循环仍为 12–90 秒 / mood。
const random = Math.random;
try {
  Math.random = () => 0.5;
  for (const mood of [0.5, 1, 1.6]) {
    const presence = createPresence(true);
    stepPresence(presence, 1.5, false, mood);
    assert.equal(presence.phase, 'visible');
    assert.ok(Math.abs(presence.dur - Math.sqrt(8 * 45)) < 1e-10, '首次可见期不得套用自然循环或 mood');
    for (let phase = 0; phase < 4; phase++) stepPresence(presence, presence.dur, false, mood);
    assert.equal(presence.phase, 'visible');
    assert.ok(Math.abs(presence.dur - Math.sqrt(12 * 90) / mood) < 1e-10, '自然循环时长必须保持原样');
  }
} finally { Math.random = random; }

// 防止登出从 1 重算造成闪亮，以及悬停/播放/拖拽重新拉亮退场节点。
for (const from of [0, 0.2, 0.73, 1]) {
  const leaving = createPresence();
  leaving.value = from;
  leavePresence(leaving);
  previous = from;
  for (let frame = 1; frame <= 135; frame++) {
    stepPresence(leaving, 0.01, true, 1);
    assert.ok(leaving.value <= previous && leaving.value >= 0, 'held 不能逆转退场');
    if (frame < 135) assert.equal(leaving.phase, 'leaving');
    previous = leaving.value;
  }
  assert.equal(leaving.value, 0);
  assert.equal(leaving.phase, 'removed', '到 0 后才可移除');
  stepPresence(leaving, 100, true, 1);
  assert.equal(leaving.value, 0, '退场终态不得复活');
}

const interrupted = createPresence(true);
stepPresence(interrupted, 0.4, false, 1);
const partial = interrupted.value;
leavePresence(interrupted);
assert.equal(interrupted.value, partial, '入场途中登出必须连续');
stepPresence(interrupted, 1.35, true, 1);
assert.equal(interrupted.phase, 'removed');

const reduced = createPresence(true, true);
assert.equal(reduced.value, 1);
assert.equal(reduced.phase, 'visible');
leavePresence(reduced, true);
assert.equal(reduced.value, 0);
assert.equal(reduced.phase, 'removed');
const changedPreference = createPresence(true);
stepPresence(changedPreference, 0, false, 1, true);
assert.equal(changedPreference.value, 1, '入场期间开启减少动态效果必须立即完成');
leavePresence(changedPreference);
stepPresence(changedPreference, 0, true, 1, true);
assert.equal(changedPreference.phase, 'removed');

const original = createPresence();
original.value = 0.2;
stepPresence(original, 0.1, true, 1);
assert.equal(original.value, 0.45, '原 held 的 0.4 秒回亮速度必须保留');
console.log('I3 入场、命中阈值、退场、打断、减少动态效果与原 held 分支通过');
