'use client';

import { useSyncExternalStore } from 'react';
import { POND_TILT_RATIO_DEFAULT } from '../../render/render-helpers';

/**
 * Phase 8 — POND_TILT_RATIO 的运行时广播 store。
 *
 * 默认 1.0 = 垂直俯视正圆（= 现状，零视觉变化）；/test 的机位 slider 改它来体验斜视椭圆。
 *
 * 为什么用模块级 store 而非 React context：BackgroundRipples / 各对象池用 createElementNS
 * 命令式生成 SVG，拿不到 context。模块 store 同时服务 React 消费者（useSyncExternalStore）
 * 和命令式消费者（getPondTilt / subscribePondTilt），并写一份 CSS 变量 `--pond-tilt`
 * 供纯 CSS 消费者读取。所有水面元素必须经此响应式读取，禁止在模块加载时读死常量。
 */
let pondTilt = POND_TILT_RATIO_DEFAULT;
const listeners = new Set<() => void>();

export function getPondTilt(): number {
  return pondTilt;
}

export function setPondTilt(v: number): void {
  pondTilt = v;
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--pond-tilt', String(v));
  }
  listeners.forEach((l) => l());
}

export function subscribePondTilt(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePondTilt(): number {
  return useSyncExternalStore(
    subscribePondTilt,
    getPondTilt,
    () => POND_TILT_RATIO_DEFAULT,
  );
}
