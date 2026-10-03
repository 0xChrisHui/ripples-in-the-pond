import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Vector4 } from 'three';
import { input, layout } from './fixture';
import { createResidentEchoRuntime } from '../../src/components/pond-gl-test3/echo-resident/runtime';

export async function verifyHost() {
  assert.ok(existsSync('src/components/pond-gl-test3/echo-resident/host/frame-input.ts'), '尚未适配最新主线场景输入');
  const { resolveResidentHostFrame } = await import('../../src/components/pond-gl-test3/echo-resident/host/frame-input');
  const { writeResidentWaterMask } = await import('../../src/components/pond-gl-test3/echo-resident/render/water-mask');
  const source = { layout, echoAvailable: true, healthy: true, sceneReady: true,
    homeActive: true, routePresence: 0.5, eclipseMix: 0.5,
    playback: 'paused' as const, otherPlaybackActive: false };
  let frame = resolveResidentHostFrame(source);
  assert.equal(frame.scenePresence, 0.25, '路由与日食连续值应在宿主合成一次');
  assert.equal(frame.sceneRestored, false, '暂停或退场中不应提前恢复');
  frame = resolveResidentHostFrame({ ...source, playback: 'ended', routePresence: 1, eclipseMix: 0 });
  assert.equal(frame.sceneRestored, true);
  assert.equal(resolveResidentHostFrame({ ...source, homeActive: false }).sceneReady, false);
  assert.equal(resolveResidentHostFrame({ ...source, echoAvailable: false }).available, false);
  const runtime = createResidentEchoRuntime({ seed: 1, layout });
  const pose = runtime.step({ ...input, reducedMotion: true }, 0).pose;
  const uniforms = { uSpheres: { value: [new Vector4(), new Vector4()] },
    uVisualDim: { value: [1, 1] }, uSphereCount: { value: 1 } };
  assert.equal(writeResidentWaterMask(uniforms, pose), true);
  assert.equal(uniforms.uSphereCount.value, 2);
  assert.equal(uniforms.uSpheres.value[1].x, pose.sx);
  assert.equal(uniforms.uSpheres.value[1].z, pose.bodyRadiusPx * 1.15);
  assert.equal(uniforms.uVisualDim.value[1], pose.effectivePresence);
  assert.equal(writeResidentWaterMask(uniforms, pose), false, '容量不足不得越界');
  uniforms.uSphereCount.value = 1;
  assert.equal(writeResidentWaterMask(uniforms, { ...pose, effectivePresence: 0 }), false);
  assert.equal(uniforms.uSphereCount.value, 1, '隐藏时不能留下水面孔洞');
  runtime.destroy();
  console.log('主线适配：路由/日食完成信号、暂停保留、失效输入、水面同帧与容量边界通过');
}
