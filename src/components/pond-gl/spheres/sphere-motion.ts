'use client';

import { getRippleTuning } from '../water/spike/ripple-tuning';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlPhysNode } from './gl-sim-setup';

/**
 * H5 — 对象运动模型（球自驱浮沉 + 播放球浮出成焦点）。
 *
 * 【公式契约（API，I3 新组件据此对接）】
 *   depth = f(time, waterLevel, nodeAttrs, params)
 *   - 共享输入：time（秒）+ waterLevel（L∈[0,1]，来自 water-level store）+ playingId（播放焦点）。
 *     ⚠ 音频能量本拍不接：GL 层暂无音频管线，挂后续音频线再纳入共享输入。
 *   - nodeAttrs：每球属性（此处用 node.z 基准深度 + node.lw 波形参数，读自 sphere-config 纯函数）。
 *   - params：每实例参数（lw/cluster）。实例差异全靠它（沿用 lw 模式，不每实例独立写公式）。
 *   球的 x/y 仍由 d3 sim 驱动（水平布局不变），本公式只算 depth（垂直浮沉）。"跟随水位"的鱼等
 *   未来组件实现同签名、各自用 waterLevel 算 x/y —— 这套"每类一条公式 + 每实例参数"即为框架。
 *
 * 【悬置项在此拍的取舍】
 *   - 公式粒度 = 每类一条公式 + 每实例参数（契约 params 已暗示，避不必要复杂度）。
 *   - 自驱浮沉触发 = 两者：① 常态自漂（lw 驱动的缓慢正弦浮沉）② 播放球浮出成焦点（升到水面之上）。
 *     两路独立可调；播放浮出用每节点 _focusLerp 缓动，避免切歌时深度突跳。
 *
 * 消费方（SphereInstances/WaterDistort/SphereOverlay）只读 node.displayZ；推进集中在
 * stepSphereMotion 单点（SphereInstances priority-0 每帧调一次），避免 _focusLerp 被多次推进。
 * 浮沉幅度/频率/焦点露出走参数板（getRippleTuning 的 bobAmp/bobScale/focusMargin）；
 * prefers-reduced-motion 时整体复位静止。
 */

const BOB_OMEGA_BASE = 0.6;  // 自漂角频率下限（rad/s）
const BOB_OMEGA_SPAN = 5;    // 由 lw.f2 映射的频率跨度 → 每球周期≈3.4–5.7s（×bobScale 调速）
const FOCUS_LERP = 0.06;     // 播放浮出缓动率（越小越慢，切歌后≈1s 浮到位）

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 单球自漂目标深度：基准 z + lw 驱动的正弦浮沉。幅度/频率走参数板（bobAmp/bobScale）。纯函数，I3 组件可参考此签名。 */
export function sphereBobDepth(node: GlPhysNode, timeSec: number, amp: number, scale: number): number {
  const lw = node.lw;
  if (!lw) return node.z;
  const omega = (BOB_OMEGA_BASE + lw.f2 * BOB_OMEGA_SPAN) * scale;
  return node.z + amp * lw.amp * Math.sin(timeSec * omega + lw.p2);
}

/**
 * 每帧推进所有球的浮沉 → 写 node.displayZ（消费方读它代替静态 node.z）。
 * motionOn=false 或 prefers-reduced-motion → displayZ 复位静态 node.z（= 回 H4 现状、零自动运动）。
 * 幅度/频率/焦点露出读参数板（getRippleTuning），H6 面板可调。
 */
export function stepSphereMotion(
  nodes: GlPhysNode[],
  timeSec: number,
  waterLevel: number,
  playingId: string | null,
  motionOn: boolean,
): void {
  const calm = !motionOn || prefersReducedMotion();
  const t = getRippleTuning();
  for (const n of nodes) {
    if (calm) { n.displayZ = n.z; n._focusLerp = 0; continue; }
    const bob = sphereBobDepth(n, timeSec, t.bobAmp, t.bobScale);
    const focusTarget = n.id === playingId ? 1 : 0;
    const lerp = (n._focusLerp ?? 0) + (focusTarget - (n._focusLerp ?? 0)) * FOCUS_LERP;
    n._focusLerp = lerp;
    // 焦点浮出：升到水面之上（取 max 避免把本就更高的浅球往下拽），按 _focusLerp 混合
    const focusZ = Math.max(bob, waterLevel + t.focusMargin);
    n.displayZ = clamp01(bob + (focusZ - bob) * lerp);
  }
}
