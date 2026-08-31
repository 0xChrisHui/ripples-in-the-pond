'use client';

import { useEffect } from 'react';
import { NX, allocPetalSim, petalNY, stepPetalWater, petalGradAt, petalDropScreen } from '../decor/water-petals-sim';
import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getEffectiveWaterLevel } from '../water/water-level';
import { project, type ProjCtx } from '../sphere-projection';
import { depthOf, displayDepthOf } from '../pointer-fx';
import { getLifeTuning } from './life-tuning';
import { lifeEnv } from './life-core';
import { prefersReducedMotion } from '../reduced-motion';
import type { GlPhysNode } from '../spheres/gl-sim-setup';

/**
 * P8-L L4 尾波场驱动器 —— 把"CPU 涟漪场生命周期"从 WaterPetals 抽出（L4-1a）。
 *
 * 场本体（u/uPrev 网格）仍在 water-petals-sim 模块级；本文件用 **refcount 单例**管它的生命周期：
 * 花瓣层（flowerPetals）与尾波扰球（wakeSpheres）任一需要即 acquire → 场存活；都释放 → 拆除。
 * 唯一 rAF 每帧 stepPetalWater 一次（refcount 保证只有一个 rAF → 天然帧号防重）。
 * ⚠ drop 强度倍率（petalDrag/Click/Wave）在注入端 → petalDrag=0 时拖尾对球也无扰动（与花瓣共享触发）。
 */

let refs = 0;
let raf = 0;
let W = 1;
let H = 1;
let lastMove = 0;
// CPU 场梯度是极小无量纲值，转成球的屏幕滑行速度必须显式标定；否则滑块拉满也不可见。
const WAKE_FORCE_GAIN = 32;

function onResize(): void {
  W = window.innerWidth;
  H = window.innerHeight;
  allocPetalSim(W, H);
}
function onMove(e: PointerEvent): void {
  const now = performance.now();
  if (now - lastMove < 28) return; // 节流（同 GL 划水手感）
  lastMove = now;
  petalDropScreen(e.clientX, e.clientY, W, H, 3, 0.16 * getRippleTuning().petalDrag);
}
function onDown(e: PointerEvent): void {
  petalDropScreen(e.clientX, e.clientY, W, H, 5, 0.6 * getRippleTuning().petalClick);
}
function onWave(e: Event): void {
  const d = (e as CustomEvent<{ x: number; y: number; petalStrength?: number }>).detail;
  if (d && typeof d.x === 'number') {
    const keyGain = d.petalStrength == null ? 1 : 1 + d.petalStrength * 2.2;
    petalDropScreen(d.x, d.y, W, H, 5, 0.5 * getRippleTuning().petalWave * keyGain);
  }
}
function loop(): void {
  stepPetalWater(); // 每帧仅此一处推进场
  raf = requestAnimationFrame(loop);
}

/** 引用计数获取尾波场（首个获取者建 alloc + 事件监听 + rAF）。 */
export function acquireWakeField(): void {
  refs++;
  if (refs > 1) return;
  onResize();
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('bg-ripple:wave', onWave);
  raf = requestAnimationFrame(loop);
}
/** 释放；归零则拆除监听 + rAF。 */
export function releaseWakeField(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0) return;
  window.removeEventListener('resize', onResize);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerdown', onDown);
  window.removeEventListener('bg-ripple:wave', onWave);
  cancelAnimationFrame(raf);
  raf = 0;
}
/** React 门控：active 时挂场，卸载/关闭即释放（PondGL 在 wakeSpheres 开时挂）。 */
export function useWakeField(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    acquireWakeField();
    return () => releaseWakeField();
  }, [active]);
}

/** L4-1b 鼠标水波扰球：鼠标轨迹波扫过哪颗水下球，哪颗被荡开。非播放/非拖拽球，用投影后屏幕位采样场梯度 →
 *  喂 _gvx/_gvy 滑行通道（自带封顶/衰减 + cluster 回位 = 分散漂游再归位）。
 *  刚没入最强、深球≈0、出水球不动（atten 随 below/wakeDepthFalloff 衰减）。乘全局呼吸包络。 */
export function stepWakeSpheres(nodes: GlPhysNode[], proj: ProjCtx, playingId: string | null, nowSec: number, on: boolean): void {
  if (!on || prefersReducedMotion()) return; // 红线⑤：reduced-motion → 无序项全冻结（L 线口径从严于"交互反馈不弱化"）
  const { wakeSphereForce, wakeDepthFalloff } = getLifeTuning();
  if (wakeSphereForce <= 0) return;
  const waterLevel = getEffectiveWaterLevel();
  const env = lifeEnv(nowSec);
  const W2 = proj.cx * 2;
  const H2 = proj.cy * 2;
  const ny = petalNY();
  for (const n of nodes) {
    if (n.id === playingId || n.fx != null || n.fy != null || n.x == null || n.y == null) continue;
    const below = waterLevel - displayDepthOf(n);
    if (below <= 0) continue; // 出水球不被尾波推
    const atten = Math.max(0, 1 - below / Math.max(0.001, wakeDepthFalloff));
    if (atten <= 0) continue;
    const p = project(n.x, n.y, depthOf(n), proj, n); // 屏幕位（波是屏幕空间的 → 视觉上波扫过哪颗动）
    const [gx, gy] = petalGradAt((p.sx / Math.max(1, W2)) * NX, (p.sy / Math.max(1, H2)) * ny);
    const k = wakeSphereForce * WAKE_FORCE_GAIN * atten * env;
    n._gvx = (n._gvx ?? 0) + gx * k;
    n._gvy = (n._gvy ?? 0) + gy * k;
    n._excite = Math.min(1, (n._excite ?? 0) + Math.min(0.05, Math.hypot(gx, gy) * k * 2)); // L3-2 尾波力 → 边缘激励
  }
}
