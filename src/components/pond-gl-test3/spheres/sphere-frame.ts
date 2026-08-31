/**
 * G4 每帧 CPU 枢纽 —— L0b 从 SphereInstances 拆出（writeFrame + InstanceBuf + hexToSRGB）。
 *
 * L 线（P8-L 生命感）所有逐帧 CPU 逻辑（滚轮去同步 / 流场 / 颤动 / 边缘激励 / 尾波 / 隐现 / 光晕呼吸）
 * 以后都长在这里；SphereInstances 只剩组件壳。
 * 深度经 pointer-fx.depthOf/displayDepthOf（per-node，含 _shiftOff）；投影 project 带 node、applyFloat 收 node。
 */
import type { RefObject } from 'react';
import { InstancedMesh, InstancedBufferAttribute, Matrix4 } from 'three';
import { HALO_R } from './sphere-shader';
import type { GlPhysNode } from './gl-sim-setup';
import { pushGlSpheresByWaves, driftSpheres, stepSphereGlide, type BgWave } from './gl-sim-waves';
import type { SphereTuning } from './sphere-tuning';
import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getSubmerge, getEffectiveWaterLevel } from '../water/water-level';
import { stepSphereMotion } from './sphere-motion';
import { project, applyFloat, type ProjCtx } from '../sphere-projection';
import { depthOf, displayDepthOf } from '../pointer-fx';
import type { LifeFlags } from '../gl-flags';
import { stepWheelDesync, stepParallax, stepShiver, stepFlowDrift, stepFlicker, lifeSeeds } from '../life/life-core';
import { getLifeTuning } from '../life/life-tuning';
import { stepWakeSpheres } from '../life/wake-field';
import { prefersReducedMotion } from '../reduced-motion';

// 球色：手动解析 hex → sRGB 0-1，绕过 three 的 Color/ColorManagement（R3F 强制 linear 会让球色暗掉近半）。
// 自定义 shader 不经 three colorspace_fragment → 手动 sRGB 直通 = 原始值原样显示（与 SVG/CSS 一致）。
export function hexToSRGB(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const WHITE: readonly [number, number, number] = [1, 1, 1];
export const BODY_RATIO = 1 / HALO_R; // body 边界占 quad 半宽的比例（≈0.862）
const tmpMatrix = new Matrix4();
const tmpA = new Matrix4(); // L3-3 果冻矩阵组合暂存
const tmpB = new Matrix4();
const TAU = Math.PI * 2;
let prevTs = 0; // L3-2 激励衰减用：上一帧时间戳（算 dt）

export interface InstanceBuf {
  aColor: Float32Array;
  aParams: Float32Array;
  aSeed: Float32Array; // L3：vec2 每实例 [相位种子 φᵢ, 激励值 _excite]
  aSubmerge: Float32Array; // 真透明分层：0=水上，1=水下
  aLifeDim: Float32Array; // R3：生命感透明只作用 halo，不削弱水上主体覆盖
  baseColors: ReadonlyArray<readonly [number, number, number]>;
  hoverLerp: Float32Array;
  dimLerp: Float32Array;
}

/** writeFrame 每帧上下文（打包成对象防 13 位置参数传错顺序还能编译过；每帧一个小对象，可忽略）。 */
export interface FrameCtx {
  nodes: GlPhysNode[];
  wavesRef: RefObject<BgWave[]>;
  playingId: string | null;
  hoverId: string | null;
  tuning: SphereTuning;
  waterOn: boolean;
  motionOn: boolean;
  proj: ProjCtx;
  drift: boolean;
  life: LifeFlags;
  waveSpeed: number;
  waterComposite: boolean;
}

/** 每帧把 sim 状态写进 InstancedMesh（矩阵 + 颜色 + params + 涟漪推球 + 平滑 lerp）。 */
export function writeFrame(mesh: InstancedMesh, buf: InstanceBuf, ctx: FrameCtx): void {
  const { nodes, wavesRef, playingId, hoverId, tuning, waterOn, motionOn, proj, drift, life, waveSpeed, waterComposite } = ctx;
  const now = performance.now();
  stepSphereMotion(nodes, now / 1000, motionOn); // 球浮动层级波动 → 写 node._waveZ
  // L2 运动无序：滚轮去同步(写 _shiftOff) / 视差去同步(写 _parGain,_parAng) / 偶发颤动(写 _shivX,_shivY)
  stepWheelDesync(nodes, life.wheelDesync);
  stepParallax(nodes, life.parallaxDesync);
  stepShiver(nodes, now, playingId, hoverId, life.shiver);
  stepFlicker(nodes, now / 1000, playingId, hoverId, life.alphaFlicker); // L5-1 隐现 → 写 _lifeDim
  wavesRef.current = wavesRef.current.filter((w) => now - w.spawnTime < w.duration);
  const rt = getRippleTuning();
  if (drift) driftSpheres(nodes, now / 1000, rt.drift); // 飘动:随机走 x/y(与沉浮深度正交→和谐)
  stepFlowDrift(nodes, now / 1000, playingId, life.flowDrift); // L2-3 集体暗流（curl 场，与 drift 正交）
  pushGlSpheresByWaves(nodes, wavesRef.current, playingId, now, getEffectiveWaterLevel(), drift, rt.wavePush, rt.wavePushDepth, waveSpeed);
  stepWakeSpheres(nodes, proj, playingId, now / 1000, life.wakeSpheres); // L4-1b 尾波扰水下球（喂 _gvx/_gvy 滑行）
  stepSphereGlide(nodes); // 涟漪推的惯性滑行收尾（_gvx 慢衰减加到位置）→ 波过后丝滑滑停

  const anyPlaying = playingId != null;
  const { aColor, aParams, aSubmerge, aLifeDim, baseColors, hoverLerp, dimLerp } = buf;
  const lt = getLifeTuning();
  const edgeOn = life.edgeWave || life.edgeExcite; // L3 边缘波/激励任一开才写 aSeed（_excite 维护恒跑，见下）
  const seedOn = edgeOn || life.haloBreath; // L5 光晕呼吸也读逐球相位种子，单开时不能全体齐闪
  const dtSec = prevTs ? Math.min(0.1, (now - prevTs) / 1000) : 0.016;
  prevTs = now;
  const exDecay = Math.exp(-dtSec / Math.max(0.05, lt.exciteDecay)); // L3-2 激励衰减系数
  const reduce = prefersReducedMotion(); // reduced-motion → 光晕呼吸冻结（隐现/运动各自已在 life-core 内冻结）

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.x == null || n.y == null) continue;
    const isPlaying = n.id === playingId;
    const isHover = n.id === hoverId;

    // 平滑：hover 放大（≈SVG r 0.22s）+ 播放淡出（≈SVG opacity 0.5s），逐帧 lerp 近似
    hoverLerp[i] += ((isHover ? 1 : 0) - hoverLerp[i]) * 0.18;
    dimLerp[i] += ((anyPlaying && !isPlaying ? 0 : 1) - dimLerp[i]) * 0.12;

    // 深度经 depthOf(含 L2-1 _shiftOff)；投影带 node(L2-2 视差去同步)；applyFloat 收 node(浮动+L2-4 颤动)
    const p = applyFloat(project(n.x, n.y, depthOf(n), proj, n), n, proj.cx, proj.cy);
    const diameter = 2 * n.radius * HALO_R * (1 + hoverLerp[i] * 0.09) * p.scale;
    // L3-3 果冻感：沿速度方向非均匀缩放（速度平滑 lerp 防抖）；关 / reduced-motion → 均匀缩放（现状）
    if (life.jelly && lt.jellyAmount > 0 && !reduce) {
      const jvx = (n._jelVx = (n._jelVx ?? 0) + ((n.vx ?? 0) + (n._gvx ?? 0) - (n._jelVx ?? 0)) * 0.2);
      const jvy = (n._jelVy = (n._jelVy ?? 0) + ((n.vy ?? 0) + (n._gvy ?? 0) - (n._jelVy ?? 0)) * 0.2);
      const e = Math.min(0.1, lt.jellyAmount * Math.hypot(jvx, jvy));
      const ang = Math.atan2(jvy, jvx);
      tmpMatrix.makeRotationZ(ang);
      tmpA.makeScale(diameter * (1 + e), diameter * (1 - e), 1);
      tmpB.makeRotationZ(-ang);
      tmpMatrix.multiply(tmpA).multiply(tmpB).setPosition(p.sx, p.sy, 0);
    } else {
      tmpMatrix.makeScale(diameter, diameter, 1).setPosition(p.sx, p.sy, 0);
    }
    mesh.setMatrixAt(i, tmpMatrix);
    // L3-2 激励维护**恒跑**（衰减 + 拖拽注入）：注入方 ripple-feed/wake-field 不看 flag，
    // 衰减若只在 edgeOn 内跑会棘轮式涨到 1 不释放 → 之后开边缘 flag 时全场幽灵爆发（review 修）。
    if ((n._excite ?? 0) > 0 || (n.fx != null && n.fy != null)) {
      let ex = (n._excite ?? 0) * exDecay;
      if (n.fx != null && n.fy != null) ex = Math.min(1, ex + 0.04);
      n._excite = ex < 0.001 ? 0 : ex;
    }
    // L3 aSeed：x=相位种子 φᵢ（边缘波），y=激励值（仅 flag 开时写 GPU buffer）
    if (seedOn) {
      buf.aSeed[i * 2] = lifeSeeds(n.id)[4] * TAU;
      buf.aSeed[i * 2 + 1] = n._excite ?? 0;
    }

    // 播放球 / hover 且有人在播 → 白；否则球色（复刻 SphereNode renderFill）
    const c = isPlaying || (isHover && anyPlaying) ? WHITE : baseColors[i];
    aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2];

    let fill = 0.52 + n.importance * 0.36;        // 复刻 baseOpacity
    if (isPlaying) fill = Math.min(0.95, fill + 0.2);
    // G6 没入淡出：水位升过球 → 球淡出（H5 读动态深度 displayZ，经 displayDepthOf）。水关时 submerge=0 不影响。
    const waterSubmerge = getSubmerge(displayDepthOf(n));
    const submerge = waterOn ? waterSubmerge : 0;
    const lifeDim = n._lifeDim ?? 1;
    aSubmerge[i] = waterSubmerge;
    aLifeDim[i] = lifeDim;
    n._visualDim = dimLerp[i] * (1 - submerge) * (waterComposite ? 1 : lifeDim);
    aParams[i * 4] = Math.min(1, fill * tuning.fill);
    aParams[i * 4 + 1] = (isHover ? 0.5 : 0.3) * tuning.halo
      * 1;
    aParams[i * 4 + 2] = dimLerp[i] * (1 - submerge); // 播放淡出；生命感透明由 aLifeDim 独立传入
    aParams[i * 4 + 3] = p.blurAmt * rt.dofStrength;          // /test3 景深失焦度 ×强度倍率
  }

  mesh.instanceMatrix.needsUpdate = true;
  (mesh.geometry.getAttribute('aColor') as InstancedBufferAttribute).needsUpdate = true;
  (mesh.geometry.getAttribute('aParams') as InstancedBufferAttribute).needsUpdate = true;
  (mesh.geometry.getAttribute('aSubmerge') as InstancedBufferAttribute).needsUpdate = true;
  (mesh.geometry.getAttribute('aLifeDim') as InstancedBufferAttribute).needsUpdate = true;
  if (seedOn) (mesh.geometry.getAttribute('aSeed') as InstancedBufferAttribute).needsUpdate = true;
}
