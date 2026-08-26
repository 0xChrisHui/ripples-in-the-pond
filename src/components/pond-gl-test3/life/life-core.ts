/**
 * P8-L「生命感」每帧计算与确定性种子的中枢。
 *
 * 后续 L 线各模块（滚轮去同步 / 视差去同步 / 流场游移 / 偶发颤动 / 边缘波 / 激励 / 果冻 /
 * 尾波 / 隐现 / 光晕呼吸）的每帧纯计算都汇到本文件，统一遵守四条和谐纪律：
 *   1. 确定性种子：每球扰动只由 id 派生（lifeSeeds），禁 Math.random，同一球每次刷新表现一致。
 *   2. 无理数频率族：各层用互不成整数倍的频率（黄金比/√2/π 等）叠加，避免同步与拍频。
 *   3. 全局呼吸包络：所有无序项幅度统一乘 lifeEnv(t)，让整塘生命感缓慢起伏而非各自为政。
 *   4. 小幅度多层叠：每层幅度克制、靠多层叠加出丰富度，避免单层过冲显假。
 */
import { hashStr } from '@/src/components/archipelago/sphere-config';
import { getLifeTuning } from './life-tuning';
import type { GlPhysNode } from '../spheres/gl-sim-setup';
import { getShift, SHIFT_MAX, displayDepthOf } from '../pointer-fx';
import { prefersReducedMotion } from '../reduced-motion';
import { getSubmerge } from '../water/water-level';
import { flowAt } from './flow-field';

/** 6 个互质乘子：对同一 32bit hash 取不同乘子再归一 → 6 个彼此不同的确定性种子。 */
const SEED_MULTIPLIERS = [0x9e3779b1, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f, 0x165667b1, 0xd3a2646d] as const;
const UINT32 = 0x100000000; // 2^32，归一分母

const seedCache = new Map<string, number[]>();

/**
 * 由 id 确定性派生 6 个 [0,1) 种子（同 id 只算一次，模块级 Map 缓存）。
 * 做法：取 hashStr(id) 后，用 6 个互质乘子分别相乘 + 位混淆再对 2^32 取模归一，
 * 保证 6 个种子彼此不同且完全确定（禁 Math.random）。
 */
export function lifeSeeds(id: string): number[] {
  const cached = seedCache.get(id);
  if (cached) return cached;
  const h = hashStr(id);
  const seeds = SEED_MULTIPLIERS.map((m) => {
    // 乘子混合 + 异或右移雪崩，再归一到 [0,1)
    let x = (h ^ m) >>> 0;
    x = Math.imul(x, m) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    return x / UINT32;
  });
  seedCache.set(id, seeds);
  return seeds;
}

/**
 * 全局呼吸包络：返回乘在所有无序项幅度上的系数。
 * lifeEnvAmount=0 时恒返 1（无呼吸 → 像素级现状）。
 */
export function lifeEnv(tSec: number): number {
  const { lifeEnvAmount, lifeEnvPeriod } = getLifeTuning();
  return 1 - lifeEnvAmount * (0.5 + 0.5 * Math.sin((2 * Math.PI * tSec) / Math.max(0.001, lifeEnvPeriod)));
}

/* ===================== L2 运动无序：每帧步进（sphere-frame 调用） ===================== */

/** L2-1 滚轮升降去同步：每球私有缓动(时滞差 s0) + 幅度差(s1，随滚轮极限收敛) → 写 _shiftOff（叠加进 depthOf）。
 *  目标必须跟随已经限速的全局 shift；不能直接追 shiftTarget，否则会绕过滚轮最高速度/加减速参数。
 *  flag 关 / reduced-motion → _shiftOff 缓动归 0（不跳变）、_lagShift 贴回 shift（重开不跳）。 */
export function stepWheelDesync(nodes: GlPhysNode[], on: boolean): void {
  const { wheelAmpVar, wheelLagVar } = getLifeTuning();
  const shift = getShift();
  const e = Math.min(1, Math.abs(shift) / SHIFT_MAX);
  const e2 = e * e;
  const off = !on || prefersReducedMotion();
  for (const n of nodes) {
    if (off) {
      n._lagShift = shift;
      const cur = n._shiftOff ?? 0;
      n._shiftOff = Math.abs(cur) < 1e-4 ? 0 : cur * 0.88; // 缓动归 0
      continue;
    }
    const s = lifeSeeds(n.id);
    const k = Math.max(0.3, 1 + (s[0] - 0.5) * 2 * wheelLagVar);
    if (n._lagShift == null) n._lagShift = shift;
    n._lagShift += (shift - n._lagShift) * 0.12 * k;
    const g = 1 + (s[1] - 0.5) * 2 * wheelAmpVar;
    const gAdj = g * (1 - e2) + e2; // mix(g,1,e²)：滚到底必全沉、滚到顶必全出
    n._shiftOff = (n._lagShift - shift) + shift * (gAdj - 1);
  }
}

/** L2-2 视差去同步：每球从种子派生 _parGain(幅度 s2)/_parAng(转角 s3)。
 *  最小视觉半径附近的小球在幅度拉满时仅保留 2%–10% 视差；关闭 / reduced-motion 时平滑回中。 */
export function stepParallax(nodes: GlPhysNode[], on: boolean): void {
  const { parVarAmp, parVarAngle } = getLifeTuning();
  const off = !on || prefersReducedMotion();
  let minRadius = Infinity;
  for (const n of nodes) minRadius = Math.min(minRadius, n.radius);
  const nearStillCutoff = minRadius + 2.5;
  for (const n of nodes) {
    const s = lifeSeeds(n.id);
    const variedGain = 1 + (s[2] - 0.5) * 2 * parVarAmp;
    const nearStillGain = 1 + (0.02 + s[2] * 0.08 - 1) * parVarAmp;
    const targetGain = off ? 1 : n.radius <= nearStillCutoff ? nearStillGain : variedGain;
    const targetAngle = off ? 0 : (s[3] - 0.5) * 2 * parVarAngle;
    n._parGain = (n._parGain ?? 1) + (targetGain - (n._parGain ?? 1)) * 0.15;
    n._parAng = (n._parAng ?? 0) + (targetAngle - (n._parAng ?? 0)) * 0.15;
  }
}

/** L2-3 流场游移：非拖拽/非播放球注入解析 curl 暗流（进 d3 vx/vy，velocityDecay+cluster 约束→漂而不散）。
 *  与 driftSpheres 正交（drift=个体抖、flow=集体流）；乘全局呼吸包络。reduced-motion / 强度 0 → 跳过。 */
export function stepFlowDrift(nodes: GlPhysNode[], nowSec: number, playingId: string | null, on: boolean): void {
  if (!on || prefersReducedMotion()) return;
  const { flowStrength, flowScale, flowSpeed } = getLifeTuning();
  if (flowStrength <= 0) return;
  const env = lifeEnv(nowSec);
  const t = nowSec * flowSpeed;
  for (const n of nodes) {
    if (n.id === playingId || n.fx != null || n.fy != null || n.x == null || n.y == null) continue;
    const [fx, fy] = flowAt(n.x * flowScale, n.y * flowScale, t);
    n.vx = (n.vx ?? 0) + fx * flowStrength * env;
    n.vy = (n.vy ?? 0) + fy * flowStrength * env;
  }
}

/** L2-4 偶发颤动：开启立即反馈，之后以 shiverInterval 为平均值随机抖动间隔；短促三摆后归位。 */
const SHIVER_DURATION = 0.48;
const SHIVER_CYCLES = 3;
const SHIVER_GAIN = 2.5;
const shivers = new Map<string, { start: number; dirX: number; dirY: number }>();
let nextShiverAt = 0;
let shiverWasOn = false;
let shiverCursor = 0;

/** 由事件序号和球种子派生 0.55–1.45 倍间隔；确定性随机，刷新后仍保持可复现。 */
function shiverIntervalFactor(eventIndex: number, seed: number): number {
  const raw = Math.sin((eventIndex + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  const unit = raw - Math.floor(raw);
  return 0.55 + unit * 0.9;
}

export function stepShiver(nodes: GlPhysNode[], nowMs: number, playingId: string | null, hoverId: string | null, on: boolean): void {
  const { shiverInterval, shiverAmp } = getLifeTuning();
  if (!on || prefersReducedMotion() || nodes.length === 0) {
    if (shivers.size) shivers.clear();
    for (const n of nodes) { if (n._shivX || n._shivY) { n._shivX = 0; n._shivY = 0; } }
    nextShiverAt = 0;
    shiverWasOn = false;
    shiverCursor = 0;
    return;
  }
  // 用户主动打开开关时立即展示一次；幅度从 0 调高后同样无需再等完整间隔。
  if (!shiverWasOn) { shiverWasOn = true; nextShiverAt = nowMs; }
  if (nowMs >= nextShiverAt && shiverAmp > 0) {
    const available = nodes
      .filter((n) => n.id !== playingId && n.id !== hoverId && n.fx == null && n.fy == null)
      .sort((a, b) => b.radius - a.radius); // 首次优先大球，方便肉眼验收；之后逐球轮换
    const cand = available[shiverCursor % Math.max(1, available.length)];
    if (cand) {
      const seeds = lifeSeeds(cand.id);
      const ang = seeds[4] * Math.PI * 2;
      shivers.set(cand.id, { start: nowMs, dirX: Math.cos(ang), dirY: Math.sin(ang) });
      shiverCursor++;
      const factor = shiverIntervalFactor(shiverCursor - 1, seeds[5]);
      nextShiverAt = nowMs + Math.max(0.1, shiverInterval * factor) * 1000;
    } else {
      nextShiverAt = nowMs + 250; // 暂时都在交互中：短延迟重试，不让本次机会消失
    }
  }
  const env = lifeEnv(nowMs / 1000);
  for (const n of nodes) {
    const sh = shivers.get(n.id);
    if (!sh) { if (n._shivX || n._shivY) { n._shivX = 0; n._shivY = 0; } continue; }
    const dt = (nowMs - sh.start) / 1000;
    const protectedNow = n.id === playingId || n.id === hoverId || n.fx != null || n.fy != null;
    if (dt >= SHIVER_DURATION || protectedNow) { shivers.delete(n.id); n._shivX = 0; n._shivY = 0; continue; }
    const p = dt / SHIVER_DURATION;
    const envelope = Math.sin(Math.PI * p); // 0→1→0，起止都准确回到原位
    const a = shiverAmp * n.radius * SHIVER_GAIN * Math.sin(Math.PI * 2 * SHIVER_CYCLES * p) * envelope * env;
    n._shivX = a * sh.dirX;
    n._shivY = a * sh.dirY;
  }
}

/* ===================== L5 呈现无序：透明度隐现（光晕呼吸在 sphere-frame 内联乘 aParams.y） ===================== */

/** L5-1 透明度时隐时现：非理比双频 w(t) + pow(w,3)长亮短隐 → 写 _lifeDim（sphere-frame 乘 aParams.z、SphereOverlay 乘 opacity）。
 *  下限 0.12（可点但近不可见）；播放/hover/拖拽球缓动回 1；reduced-motion 恒 1；flickerDepthBias>0 时水下更隐。 */
export function stepFlicker(nodes: GlPhysNode[], nowSec: number, playingId: string | null, hoverId: string | null, on: boolean): void {
  const { flickerAmount, flickerSpeed, flickerDepthBias } = getLifeTuning();
  const env = lifeEnv(nowSec);
  const reduce = prefersReducedMotion();
  for (const n of nodes) {
    const exempt = n.id === playingId || n.id === hoverId || n.fx != null || n.fy != null;
    let target = 1;
    if (on && !reduce && !exempt && flickerAmount > 0) {
      const phi = lifeSeeds(n.id)[5] * Math.PI * 2;
      const w = 0.5 + 0.3 * Math.sin(flickerSpeed * nowSec + phi) + 0.2 * Math.sin(flickerSpeed * nowSec * 1.618 + 2.3 * phi);
      const shaped = w * w * w; // 长亮短隐：大部分时间近 1、偶尔快速下潜
      const depthW = flickerDepthBias > 0 ? 1 + flickerDepthBias * getSubmerge(displayDepthOf(n)) : 1;
      target = Math.max(0.12, 1 - flickerAmount * shaped * env * depthW);
    }
    const cur = n._lifeDim ?? 1;
    n._lifeDim = cur + (target - cur) * 0.15; // 缓动 → 豁免切换 / 关灯不跳变
  }
}
