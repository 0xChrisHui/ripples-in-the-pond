import assert from 'node:assert/strict';
import test from 'node:test';
import { circlePlayback, circlePose } from '../../../src/components/music-catalog/listening/circle/circle-state';
import { createCircleMotion, stepCircleMotion } from '../../../src/components/music-catalog/listening/circle/circle-motion';

test('首播准备不进入日食；真实播放、短暂缓冲、终止正确交接', () => {
  let state = circlePlayback({ trackId: 'a', eclipse: false }, 'a', 'preparing', true);
  assert.equal(state.eclipse, false);
  state = circlePlayback(state, 'a', 'playing', true);
  assert.equal(state.eclipse, true);
  state = circlePlayback(state, 'a', 'preparing', true);
  assert.equal(state.eclipse, true);
  for (const phase of ['idle', 'ended', 'error']) assert.equal(circlePlayback(state, 'a', phase, true).eclipse, false);
});

test('换曲或交还路由控制后，旧播放身份不能保留日食', () => {
  const playing = { trackId: 'a', eclipse: true };
  assert.equal(circlePlayback(playing, 'b', 'preparing', true).eclipse, false);
  assert.equal(circlePlayback(playing, 'a', 'playing', false).eclipse, false);
});

test('漂移以页面可视高度计量，圆大小不改变漂移距离', () => {
  const motion = createCircleMotion(9); stepCircleMotion(motion, 3);
  const large = circlePose(660, 900, 3, false, motion);
  const small = circlePose(244, 900, 3, false, motion);
  const short = circlePose(660, 450, 3, false, motion);
  assert.equal(large.dx, small.dx); assert.equal(large.dy, small.dy);
  assert.equal(large.dx, short.dx * 2); assert.equal(large.dy, short.dy * 2);
  assert.ok(Math.hypot(large.dx, large.dy) > 900 * .01);
});

test('随机运动长期不超过可视高度5%，基本呼吸不改变尺寸基准', () => {
  for (const width of [244, 300, 556, 660]) {
    for (const height of [667, 844, 900]) {
      const motion = createCircleMotion(17);
      for (let time = 0; time < 3600; time += 3.7) {
        stepCircleMotion(motion, 3.7);
        const pose = circlePose(width, height, time, false, motion);
        assert.ok(Math.abs(pose.dx) <= height * .05 + 1e-9);
        assert.ok(Math.abs(pose.dy) <= height * .05 + 1e-9);
        assert.ok(pose.radius > width * .26 && pose.radius < width * .30);
      }
    }
  }
});

test('减少动态保持可见尺寸，移除位移和大小呼吸', () => {
  const motion = createCircleMotion(23); stepCircleMotion(motion, 2);
  assert.deepEqual(circlePose(300, 844, 0, true, motion), circlePose(300, 844, 500, true, motion));
  assert.equal(circlePose(300, 844, 90, true, motion).dx, 0);
  assert.equal(circlePose(300, 844, 90, true, motion).dy, 0);
});
