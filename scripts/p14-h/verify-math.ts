import assert from 'node:assert/strict';
import { RESIDENT_ECHO_DEFAULTS, validateResidentConfig } from '../../src/components/pond-gl-test3/echo-resident/config';
import { createResidentRandom } from '../../src/components/pond-gl-test3/echo-resident/random';
import { resolveResidentBounds } from '../../src/components/pond-gl-test3/echo-resident/render/bounds';
import { createResidentEchoRuntime } from '../../src/components/pond-gl-test3/echo-resident/runtime';
import { input, layout } from './fixture';

const config = RESIDENT_ECHO_DEFAULTS;
assert.equal(validateResidentConfig({ ...config, visibleSeconds: [45, 20] }).valid, false);
assert.equal(validateResidentConfig({ ...config, diameterMultiplier: Infinity }).valid, false);
assert.equal(validateResidentConfig({ ...config, residentConfigVersion: 2 }).valid, false);
assert.equal(validateResidentConfig(config).valid, true);
const a = createResidentRandom(7), b = createResidentRandom(7);
for (let i = 0; i < 20; i++) a.presence.next();
assert.equal(a.drift.next(), b.drift.next(), '显隐不得消耗漂移随机流');
assert.equal(a.depth.next(), b.depth.next());
const bounds = resolveResidentBounds(layout, config);
assert.equal(bounds.sizeClamped, false);
assert.ok(bounds.rect.y >= 92 + bounds.envelopeRadiusPx, '光晕和焦点环必须避开 Header');
const tiny = resolveResidentBounds({ ...layout, width: 90, height: 150, controls: [] }, config);
assert.equal(tiny.sizeClamped, true);
assert.ok(tiny.sizeScale > 0 && tiny.sizeScale < 1);
const blocked = resolveResidentBounds({ ...layout, controls: [{ x: 0, y: 0, width: 1440, height: 900 }] }, config);
assert.equal(blocked.sizeScale, 0, '完全被 UI 占满时不能有幽灵命中');
const invalid = createResidentEchoRuntime({ seed: 1, clock: () => 0,
  layout: { ...layout, width: NaN, baseRadiusPx: Infinity, surface: NaN } });
assert.ok(Number.isFinite(invalid.getSnapshot().pose.depth), '非法几何不得生成 NaN 深度');
assert.ok(Number.isFinite(invalid.getSnapshot().pose.bodyRadiusPx), '非法几何不得生成无限半径');
invalid.destroy();
const make = () => createResidentEchoRuntime({ seed: 12, layout, clock: () => 0 });
const normalRate = make(), lowRate = make();
normalRate.step(input, 0); lowRate.step(input, 0);
for (let ms = 50; ms <= 5000; ms += 50) normalRate.step(input, ms);
for (let ms = 200; ms <= 5000; ms += 200) lowRate.step(input, ms);
assert.ok(Math.abs(normalRate.getSnapshot().motionSeconds - lowRate.getSnapshot().motionSeconds) < 1e-8,
  '低帧率必须保留真实可见经过时间，不能逐帧丢弃超过50ms的部分');
assert.ok(Math.abs(normalRate.getSnapshot().pose.sx - lowRate.getSnapshot().pose.sx) < 1e-8);
normalRate.destroy(); lowRate.destroy();
const phoneLayout = { ...layout, width: 375, height: 844, baseRadiusPx: 34,
  controls: [{ x: 0, y: 0, width: 375, height: 80 }] };
for (const seed of [1, 9, 12]) {
  const phone = createResidentEchoRuntime({ seed, layout: phoneLayout });
  const frame = { ...input, layout: phoneLayout }, start = phone.step(frame, 0).pose;
  for (let ms = 50; ms <= 5000; ms += 50) phone.step(frame, ms);
  const end = phone.getSnapshot().pose;
  assert.ok(Math.hypot(end.sx - start.sx, end.sy - start.sy) >= 5, '窄屏5秒内必须形成可辨位移');
  phone.destroy();
}
const r1 = make(), r2 = make();
let previous = r1.step(input, 0).pose;
let maxSpeed = 0;
for (let ms = 25; ms <= 60000; ms += 25) {
  const snapshot = r1.step(input, ms), p = snapshot.pose;
  assert.ok(p.sx >= bounds.rect.x - 1e-8 && p.sx <= bounds.rect.x + bounds.rect.width + 1e-8);
  assert.ok(p.sy >= bounds.rect.y - 1e-8 && p.sy <= bounds.rect.y + bounds.rect.height + 1e-8);
  assert.ok(p.depth >= 0.02 && p.depth <= 0.98);
  assert.ok(p.breathScale >= 0.9 && p.breathScale <= 1.1);
  assert.ok(Math.abs(p.bodyRadiusPx - 48 * p.breathScale) < 1e-8, '相同无透视状态直径应翻倍');
  maxSpeed = Math.max(maxSpeed, Math.hypot(p.sx - previous.sx, p.sy - previous.sy) / 0.025);
  previous = p;
}
r2.step(input, 0);
for (let ms = 50; ms <= 60000; ms += 50) r2.step(input, ms);
const p1 = r1.getSnapshot(), p2 = r2.getSnapshot();
assert.ok(Math.abs(p1.pose.sx - p2.pose.sx) < 1e-7);
assert.ok(Math.abs(p1.pose.depth - p2.pose.depth) < 1e-7);
assert.deepEqual(p1.randomCalls, p2.randomCalls, '抽样应随换段增长，不随帧率增长');
assert.ok(maxSpeed <= 6 + 1e-7);
const calls = p1.randomCalls;
const resized = r1.step({ ...input, layout: { ...layout, width: 375, height: 844,
  controls: [{ x: 0, y: 0, width: 375, height: 80 }] } }, 60000);
assert.deepEqual(resized.randomCalls, calls, 'resize 不重抽运动参数');
assert.ok(resized.pose.sx + resized.pose.haloRadiusPx <= 359);
assert.ok(resized.pose.sx - resized.pose.haloRadiusPx >= 16);
r1.destroy(); r2.destroy();
console.log(`数学：60s 定向重放；峰值漂移 ${maxSpeed.toFixed(5)} CSS px/s；帧率一致误差 <1e-7`);
