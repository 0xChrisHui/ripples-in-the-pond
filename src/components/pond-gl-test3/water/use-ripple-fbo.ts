'use client';

import { Vector4 } from 'three';

/**
 * G5 涟漪源管理（程序化方案，2026-06-13 取代原 ping-pong FBO）。
 *
 * 涟漪 = Vector4(uv.x, uv.y, 起始时间秒, 强度)；z<0 表示空槽。
 * shader 用 `uTime - z` 算 age 做解析扩散。命令式 mutate 放模块级函数（避 immutability lint）。
 */
export const MAX_RIPPLES = 5;

/** 添加一个涟漪：覆盖最老的槽（z 最小 = 起始最早） */
export function addRipple(ripples: Vector4[], x: number, y: number, t0: number, strength: number): void {
  let oldest = 0;
  for (let i = 1; i < ripples.length; i++) {
    if (ripples[i].z < ripples[oldest].z) oldest = i;
  }
  ripples[oldest].set(x, y, t0, strength);
}
