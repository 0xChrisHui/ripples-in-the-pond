/**
 * P20 气泡几何（纯函数）：透视缩放、路径避让检查、到球边缘的淡出系数。
 * 从 bubble-sim.ts 拆出，保持单文件 ≤220 行；SimEnv 类型留在 bubble-sim。
 */
import type { Disc } from './bubble-env';
import type { BubbleTuning } from '../bubble-tuning';

/** 几何计算只需要的环境子集（SimEnv 满足它）。 */
export interface GeoEnv {
  w: number; h: number;
  discs: ReadonlyArray<Disc>; discCount: number;
  surfaceD: number;
  tuning: BubbleTuning;
}

const PATH_SAMPLES = 10;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 上升进度 u∈[0,1] → 屏幕缩放（绕画面中心）：池底 0.5+depthStart → 水面 0.5+surfaceD。 */
export function scaleAt(env: GeoEnv, u: number): number {
  const d0 = env.tuning.depthStart;
  return 0.5 + d0 + (env.surfaceD - d0) * u;
}

/** 整条径向上升路径是否都不碰球（含蛇行余量）。avoidSpawn 关时恒为 true。 */
export function pathClear(env: GeoEnv, ox: number, oy: number): boolean {
  if (!env.tuning.avoidSpawn) return true;
  const cx = env.w / 2, cy = env.h / 2;
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const s = scaleAt(env, i / PATH_SAMPLES);
    const px = cx + (ox - cx) * s, py = cy + (oy - cy) * s;
    for (let k = 0; k < env.discCount; k++) {
      const d = env.discs[k];
      if (Math.hypot(px - d.x, py - d.y) < d.r + env.tuning.swayMargin) return false;
    }
  }
  return true;
}

/** 到最近球边缘的距离 → 0..1 淡出系数（贴边 0，远离 1）。 */
export function discFade(env: GeoEnv, x: number, y: number): number {
  if (!env.tuning.avoidFade) return 1;
  const band = env.tuning.edgeBand * Math.min(env.w, env.h);
  let f = 1;
  for (let k = 0; k < env.discCount; k++) {
    const d = env.discs[k];
    f = Math.min(f, clamp01((Math.hypot(x - d.x, y - d.y) - d.r) / band));
  }
  return f;
}
