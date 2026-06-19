'use client';

import { useEffect } from 'react';

/**
 * /test2 专属水位 store —— 与 /test1 的 `pond-gl/water/water-level.ts` **完全独立**。
 *
 * 逐字同范式（模块级单例 + 滚轮/捏合控制 + rAF 缓动），仅靠"独立模块实例"达成解耦：
 * /test2 在此写水位（滚轮/nudge）不再波及 /test1 的水位单例（task 2「两者毫无关联」）。
 * 无 localStorage（水位本就不持久化），故无需改 key。
 */

const PINCH_TO_WHEEL = 2;

let target = 0;
let current = 0;
let lastWheelAt = -9999;

export function getWaterLevel(): number {
  return current;
}
export function getLastWheelAt(): number {
  return lastWheelAt;
}

export function nudgeWaterLevel(deltaY: number): void {
  target = Math.max(0, Math.min(1, target - deltaY * 0.0008));
  lastWheelAt = performance.now();
}

export function stepWaterLevel(): void {
  current += (target - current) * 0.12;
  if (Math.abs(target - current) < 0.0004) current = target;
}

export function getSubmerge(z: number): number {
  const t = Math.min(1, Math.max(0, (current - z + 0.02) / 0.12));
  return t * t * (3 - 2 * t);
}

export function depthFactor(z: number, pondDepth: number): number {
  return Math.min(1, Math.max(0, (current - z) / Math.max(0.001, pondDepth)));
}

export function useWaterLevelControl(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      nudgeWaterLevel(e.deltaY);
    };
    let lastDist = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 2) lastDist = dist(e.touches); };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = dist(e.touches);
      if (lastDist) nudgeWaterLevel(-(d - lastDist) * PINCH_TO_WHEEL);
      lastDist = d;
    };
    const onTouchEnd = (e: TouchEvent) => { if (e.touches.length < 2) lastDist = 0; };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    let raf = 0;
    const loop = () => {
      stepWaterLevel();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      cancelAnimationFrame(raf);
    };
  }, [active]);
}
