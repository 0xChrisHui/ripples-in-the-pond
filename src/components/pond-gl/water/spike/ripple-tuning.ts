'use client';

/**
 * H1 spike 波纹参数 store（H6"波纹/运动参数板"的提前 spike 版，范式同 sphere-tuning）。
 *
 * 单例 + pub/sub + localStorage。RttSpike 每帧读 getRippleTuning() 写 shader uniform；
 * RippleSpikePanel 用 useSyncExternalStore 订阅渲染滑块。H6 正式化时挪进 overlay/ 扩展。
 */
export interface RippleTuning {
  damping: number;    // sim 阻尼（越大涟漪持续越久；0.995 起）
  perturb: number;    // 折射强度（高度场梯度 → UV 偏移）
  dropMove: number;   // 滴水强度·鼠标移动
  dropClick: number;  // 滴水强度·点击
  dropRadius: number; // 滴水半径（占屏比）
  specular: number;   // 月光高光强度
}

export const DEFAULT_RIPPLE_TUNING: RippleTuning = {
  damping: 0.995,
  perturb: 0.04,
  dropMove: 0.012,
  dropClick: 0.16,
  dropRadius: 0.05,
  specular: 0.5,
};

const KEY = 'pond-gl-ripple-spike';

function load(): RippleTuning {
  if (typeof window === 'undefined') return { ...DEFAULT_RIPPLE_TUNING };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_RIPPLE_TUNING };
    return { ...DEFAULT_RIPPLE_TUNING, ...(JSON.parse(raw) as Partial<RippleTuning>) };
  } catch {
    return { ...DEFAULT_RIPPLE_TUNING };
  }
}

let current: RippleTuning = load();
const listeners = new Set<() => void>();

/** shader 侧每帧读（稳定引用，setRippleTuning 才换新对象 → 触发 re-render） */
export function getRippleTuning(): RippleTuning {
  return current;
}

export function setRippleTuning(patch: Partial<RippleTuning>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeRippleTuning(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** "保存"：当前参数写 localStorage，刷新后保留 */
export function saveRippleTuning(): void {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(current));
}

/** 重置为默认并清除已保存值 */
export function resetRippleTuning(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
  setRippleTuning({ ...DEFAULT_RIPPLE_TUNING });
}
