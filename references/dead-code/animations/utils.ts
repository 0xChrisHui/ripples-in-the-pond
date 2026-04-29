/**
 * Phase 6 B2 — patatap 动画移植 helpers（搬自 references/patatap/src/underscore.js）
 */

export const TWO_PI = Math.PI * 2;
export const DURATION = 1000; // 单次动画基础时长（ms）

export function range(n: number): number[] {
  return [...Array(n).keys()];
}

export function clamp(v: number, a: number, b: number): number {
  return Math.min(Math.max(v, a), b);
}

export function map(v: number, a: number, b: number, c: number, d: number): number {
  const pct = (v - a) / (b - a);
  return pct * (d - c) + c;
}
