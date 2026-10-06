import assert from 'node:assert/strict';
import { createResidentEchoRuntime } from '../../src/components/pond-gl-test3/echo-resident/runtime';
import { input, layout } from './fixture';

// 真实宿主在SSR/首帧使用1×1布局；展开后不能保留整段零距离路线。
const bootstrap = createResidentEchoRuntime({ seed: 9, layout: { ...layout, width: 1, height: 1 } });
const origin = bootstrap.step(input, 0).pose;
for (let i = 1; i <= 100; i++) bootstrap.step(input, i * 50);
const moved = bootstrap.getSnapshot().pose;
assert.ok(Math.hypot(moved.sx - origin.sx, moved.sy - origin.sy) > 1, '首个可用布局应立即形成漂移路线');
bootstrap.destroy();

const runtime = createResidentEchoRuntime({ seed: 9, layout, clock: () => 0 });
let now = 0;
const advance = (seconds: number, frame = input) => {
  for (let i = 0; i < Math.round(seconds * 20); i++) runtime.step(frame, now += 50);
  return runtime.getSnapshot();
};
runtime.step(input, 0);
let state = advance(5);
assert.equal(state.phase, 'visible');
const beforeStall = state.pose;
runtime.step(input, now += 10000);
assert.equal(runtime.getSnapshot().pose.sx, beforeStall.sx, '长卡顿恢复帧不能追赶路线而跳位');
state = advance(1, { ...input, playback: 'playing' });
const frozen = state.pose;
advance(30, { ...input, playback: 'paused' });
assert.equal(runtime.getSnapshot().pose.sx, frozen.sx);
assert.equal(runtime.getSnapshot().pose.depth, frozen.depth);
assert.equal(runtime.getSnapshot().pose.breathScale, frozen.breathScale);
const phase = runtime.getSnapshot().motionSeconds;
advance(10, { ...input, playback: 'ended', sceneRestored: false });
assert.equal(runtime.getSnapshot().motionSeconds, phase, '退场未完成不能恢复运动');
advance(8, { ...input, playback: 'ended' });
assert.ok(runtime.getSnapshot().motionSeconds > phase);
const beforeOther = runtime.getSnapshot();
advance(10, { ...input, otherPlaybackActive: true, scenePresence: 0 });
assert.equal(runtime.getSnapshot().motionSeconds, beforeOther.motionSeconds);
assert.equal(runtime.getSnapshot().presenceSeconds, beforeOther.presenceSeconds);
assert.equal(runtime.getSnapshot().pose.interactive, false, '其他作品接管时无幽灵命中');
advance(1);
runtime.setVisibility(true);
const before = runtime.getSnapshot();
runtime.step(input, now += 3600000);
assert.equal(runtime.getSnapshot().motionSeconds, before.motionSeconds);
runtime.setVisibility(false);
runtime.step(input, now += 3600000);
assert.equal(runtime.getSnapshot().motionSeconds, before.motionSeconds, '前台第一帧重置时钟');
const reducedPose = runtime.getSnapshot().pose;
advance(30, { ...input, reducedMotion: true });
assert.equal(runtime.getSnapshot().pose.sx, reducedPose.sx);
assert.equal(runtime.getSnapshot().pose.presence, 1);
assert.equal(runtime.getSnapshot().pose.interactive, true);
advance(1, { ...input, reducedMotion: false });
runtime.setInteraction({ focused: true });
advance(1);
assert.equal(runtime.getSnapshot().pose.presence, 1);
const focusPose = runtime.getSnapshot().pose;
advance(60);
assert.equal(runtime.getSnapshot().pose.sx, focusPose.sx);
runtime.setInteraction({ focused: false });
advance(10);
assert.ok(runtime.getSnapshot().motionSeconds > before.motionSeconds);
let hiddenSeen = false, fadingHoverSeen = false;
for (let i = 0; i < 2400; i++) {
  state = runtime.step(input, now += 50);
  if (state.phase === 'fading_out' && !fadingHoverSeen) {
    runtime.setInteraction({ hovered: true }); advance(1);
    assert.equal(runtime.getSnapshot().pose.presence, 1);
    runtime.setInteraction({ hovered: false }); fadingHoverSeen = true;
  }
  if (state.phase === 'hidden') {
    assert.equal(state.pose.interactive, false);
    assert.equal(state.pose.tabbable, false);
    assert.equal(state.pose.effectivePresence, 0); hiddenSeen = true;
  }
}
assert.ok(hiddenSeen && fadingHoverSeen);
assert.equal(runtime.step({ ...input, available: false }, now += 50).pose.interactive, false);
assert.equal(runtime.step({ ...input, healthy: false }, now += 50).pose.effectivePresence, 0);
let notified = 0;
runtime.subscribe(() => notified++);
runtime.destroy(); runtime.destroy();
runtime.step(input, now += 50);
assert.equal(runtime.getSnapshot().destroyed, true);
assert.equal(runtime.getSnapshot().pose.interactive, false);
assert.equal(notified, 1, 'destroy 只通知一次并清理所有订阅');
console.log('生命周期：显隐、淡出交互、暂停、场景恢复、后台、动态 reduced-motion 与幂等销毁通过');
