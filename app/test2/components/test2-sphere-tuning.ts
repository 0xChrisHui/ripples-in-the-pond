'use client';

/**
 * /test2 专属调色 store —— 与 /test1 的 `pond-gl/spheres/sphere-tuning.ts` **完全独立**。
 *
 * 范式逐字相同（单例 + pub/sub + localStorage 持久化），但：
 *   ① 独立模块实例 → 内存态不再与 /test1 共享；
 *   ② localStorage key 改 `'test2-tune'`（原 `'pond-gl-tune'`）→ 刷新后也不互相覆盖。
 * 这样在 /test2 调球色不再影响 /test1，反之亦然（task 2「两者毫无关联」）。
 */
export interface SphereTuning {
  brightness: number;  // 亮度乘数（1 = 原样）
  contrast: number;    // 对比度（绕 0.5 收放，1 = 原样）
  saturation: number;  // 饱和度（0 = 灰，1 = 原样，>1 更艳）
  halo: number;        // 光晕强度乘数（作用于 haloPeak）
  fill: number;        // 球体浓度乘数（作用于 fillOpacity）
}

export const DEFAULT_TUNING: SphereTuning = {
  brightness: 1,
  contrast: 1,
  saturation: 1.5, // 用户指定
  halo: 1.9,       // 用户指定
  fill: 1.6,       // 用户指定
};

const KEY = 'test2-tune';

function load(): SphereTuning {
  if (typeof window === 'undefined') return { ...DEFAULT_TUNING };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_TUNING };
    return { ...DEFAULT_TUNING, ...(JSON.parse(raw) as Partial<SphereTuning>) };
  } catch {
    return { ...DEFAULT_TUNING };
  }
}

let current: SphereTuning = load();
const listeners = new Set<() => void>();

/** shader 侧每帧读（返回稳定引用，setTuning 才换新对象 → 触发 re-render） */
export function getTuning(): SphereTuning {
  return current;
}

export function setTuning(patch: Partial<SphereTuning>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeTuning(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 点击"保存"：当前参数写 localStorage，刷新后保留 */
export function saveTuning(): void {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(current));
}

/** 重置为默认并清除已保存值 */
export function resetTuning(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
  setTuning({ ...DEFAULT_TUNING });
}
