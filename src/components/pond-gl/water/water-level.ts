'use client';

import { useEffect } from 'react';

/**
 * G6 — 水位 store + 滚轮控制（程序化单例，范式同 sphere-tuning）。
 *
 * 水位 L ∈ [0,1]，直接映射球的 z 域（gl-sim-setup.ts 里 node.z ∈ [0,1]）。
 * - target：滚轮拨到的目标水位
 * - current：缓动后的实时水位（shader / 指示器每帧读，避免突跳）
 * 命令式 mutate 放模块级（避 react-hooks/immutability）；不做 pub/sub —— 读方全部走 rAF 直读，
 * 不触发 React 重渲染（同 SphereOverlay 的每帧 DOM 写法）。
 */

let target = 0;
let current = 0;
let lastWheelAt = -9999; // 指示器淡入用：最近一次滚轮的时间戳（performance.now）

/** shader / 指示器每帧读的实时水位（已缓动） */
export function getWaterLevel(): number {
  return current;
}
/** 指示器读：最近滚轮时间，用于"滚轮时淡入、静止后淡出" */
export function getLastWheelAt(): number {
  return lastWheelAt;
}

/** 滚轮拨动水位：deltaY<0（上滚）抬高水位、更多球入水；clamp [0,1] */
export function nudgeWaterLevel(deltaY: number): void {
  target = Math.max(0, Math.min(1, target - deltaY * 0.0008));
  lastWheelAt = performance.now();
}

/** 每帧把 current 缓动逼近 target（lerp 0.12，同球 hover/dim 的手感） */
export function stepWaterLevel(): void {
  current += (target - current) * 0.12;
  if (Math.abs(target - current) < 0.0004) current = target;
}

/**
 * 球的"没入程度" 0..1：0 = 水上/贴面（露出，原样）、1 = 完全没入（被水波盖住、淡出）。
 * 用 current(已缓动) − 球 z 判定：z 越低于水位越没入。阈值即三态边界（贴面带 ≈ -0.02..0）。
 * 集中在此 → 球淡出与 overlay 标题淡出共用同一判定（G6-2 贴面涟漪也复用）。
 */
export function getSubmerge(z: number): number {
  const t = Math.min(1, Math.max(0, (current - z + 0.02) / 0.12)); // 线性映射 [-0.02,0.10] → [0,1]
  return t * t * (3 - 2 * t); // smoothstep 软化出入水
}

/**
 * 滚轮控制 + 缓动驱动 hook。active=false（wheelMode≠waterLevel 或水面关）时**不挂任何监听**，
 * 滚轮回归原行为（GL 沙盒里 SVG 已隐，等于无操作；P2-c 后归 GL 缩放）。
 */
export function useWaterLevelControl(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    // preventDefault 截断页面滚动；passive:false 才允许 preventDefault
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      nudgeWaterLevel(e.deltaY);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    // 独立 rAF 只负责缓动；读方（球 shader / 指示器）各自 rAF 直读 current
    let raf = 0;
    const loop = () => {
      stepWaterLevel();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
    };
  }, [active]);
}
