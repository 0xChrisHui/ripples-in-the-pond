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

/**
 * 上升路径上的点：ax/ay 是水面落点，进度 u∈[0,1]（0 池底 → 1 水面）。
 * 池底起点 = 落点向画面中心收缩 driftFrac，所以横向位移 = 落点到中心距离 × driftFrac。
 * 之前沿用球的一点透视（缩放 0.55→1.025）位移占 46%，像超广角；圆圈从最深层升到水面只有约 17%，默认取它。
 */
export function pathPoint(env: GeoEnv, ax: number, ay: number, u: number): { x: number; y: number } {
  const k = env.tuning.driftFrac * (1 - u);
  const cx = env.w / 2, cy = env.h / 2;
  return { x: ax - (ax - cx) * k, y: ay - (ay - cy) * k };
}

/** 整条上升路径是否都不碰球（含蛇行余量）。avoidSpawn 关时恒为 true。 */
export function pathClear(env: GeoEnv, ax: number, ay: number): boolean {
  if (!env.tuning.avoidSpawn) return true;
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const p = pathPoint(env, ax, ay, i / PATH_SAMPLES);
    for (let k = 0; k < env.discCount; k++) {
      const d = env.discs[k];
      if (Math.hypot(p.x - d.x, p.y - d.y) < d.r + env.tuning.swayMargin) return false;
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
