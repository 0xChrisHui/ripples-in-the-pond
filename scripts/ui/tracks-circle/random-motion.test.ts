import assert from 'node:assert/strict';
import test from 'node:test';
import { createCircleMotion, stepCircleMotion } from '../../../src/components/music-catalog/listening/circle/circle-motion';

test('不同会话有不同方向与路径，固定种子可复现问题', () => {
  const paths = Array.from({ length: 16 }, (_, seed) => {
    const motion = createCircleMotion(seed + 1);
    stepCircleMotion(motion, 2);
    return [motion.x, motion.y];
  });
  assert.ok(paths.some(([x]) => x > 0) && paths.some(([x]) => x < 0));
  assert.ok(paths.some(([, y]) => y > 0) && paths.some(([, y]) => y < 0));
  const a = createCircleMotion(5); const b = createCircleMotion(5);
  stepCircleMotion(a, 30); stepCircleMotion(b, 30); assert.deepEqual(a, b);
  assert.notDeepEqual(paths[0], paths[1]);
});

test('路径与帧率无关，低帧率不丢掉运动时间', () => {
  const fast = createCircleMotion(22); const slow = createCircleMotion(22);
  for (let i = 0; i < 600; i++) stepCircleMotion(fast, .02);
  for (let i = 0; i < 24; i++) stepCircleMotion(slow, .5);
  for (const key of ['x', 'y', 'vx', 'vy'] as const) assert.ok(Math.abs(fast[key] - slow[key]) < 1e-8);
});

test('随机换目标时位置与速度连续，不在转向点反弹或跳转', () => {
  const motion = createCircleMotion(31);
  stepCircleMotion(motion, motion.remaining - .00001);
  const before = { ...motion };
  stepCircleMotion(motion, .00002);
  assert.ok(motion.remaining > 1);
  assert.ok(Math.hypot(motion.x - before.x, motion.y - before.y) < .0001);
  assert.ok(Math.hypot(motion.vx - before.vx, motion.vy - before.vy) < .0001);
});

test('长期路径保持有限且持续探索，读取状态不重置运动', () => {
  const motion = createCircleMotion(19); const visited = new Set<string>();
  for (let i = 0; i < 3600; i++) {
    stepCircleMotion(motion, 1);
    assert.ok(Number.isFinite(motion.x) && Number.isFinite(motion.y));
    assert.ok(Math.abs(Math.tanh(motion.x)) < 1 && Math.abs(Math.tanh(motion.y)) < 1);
    visited.add(`${Math.sign(motion.x)},${Math.sign(motion.y)}`);
  }
  assert.equal(visited.size, 4);
});
