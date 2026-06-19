'use client';

/**
 * G4 调色 — GL 球视觉参数实时微调 store（滑块面板写、shader 读）。
 *
 * 单例 + pub/sub + localStorage 持久化。SphereInstances 每帧读 getTuning() 写 shader uniform/aParams；
 * TunePanel 用 useSyncExternalStore 订阅渲染滑块。值全部是"1 = 原样"的乘数/中性值。
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
  saturation: 1,
  halo: 1.9,  // 用户指定
  fill: 1.6,  // 用户指定
};

// /test3 专属键（与 /test1 共享键 LEGACY_KEY 解耦 → 两边互不干扰）；首载迁移旧值，不丢已存调参。
const KEY = 'test3-tune';
const LEGACY_KEY = 'pond-gl-tune';

function load(): SphereTuning {
  if (typeof window === 'undefined') return { ...DEFAULT_TUNING };
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY); // 一次性迁移：旧共享键 → test3 独立键
      if (legacy) { localStorage.setItem(KEY, legacy); raw = legacy; }
    }
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
