'use client';

/**
 * 波纹/运动参数 store（H1 spike 起，H6 升格为 H 线统一"波纹/运动参数板"后端，范式同 sphere-tuning）。
 *
 * 单例 + pub/sub + localStorage。WaterDistort/RttSpike 每帧读 getRippleTuning() 写 ripple uniform；
 * sphere-motion 读 bobAmp/bobScale/focusMargin 算球浮沉；RippleSpikePanel 用 useSyncExternalStore 订阅渲染滑块。
 * H6 收尾：spike 文件正式化挪进 overlay/ 的 cleanup 留作后续（不影响功能）。
 */
export interface RippleTuning {
  damping: number;    // sim 阻尼（越大涟漪持续越久；0.995 起）
  refract: number;    // 折射强度（位移 ∝ 高度梯度×此值，clamp 上限；旧 perturb 改名换标度，老存档自动回默认）
  dropMove: number;   // 滴水强度·鼠标移动
  dropClick: number;  // 滴水强度·点击
  dropRadius: number; // 滴水半径（占屏比）
  specular: number;   // 月光高光强度
  trail: number;      // H4 拖球尾迹强度（被拖的球留下的水痕）
  splash: number;     // H4 球穿过水面溅起强度
  ambient: number;    // H4 常驻微波强度（塘面始终有细腻波动；0=关）
  bobAmp: number;     // H5 球自漂浮沉幅度（z 单位；0=不自漂）
  bobScale: number;   // H5 球自漂频率倍率（×lw 基频；越大越快）
  focusMargin: number;// H5 播放球浮出水面的露出量（越大越高越清晰）
}

export const DEFAULT_RIPPLE_TUNING: RippleTuning = {
  damping: 0.995,
  refract: 0.6,
  dropMove: 0.008, // K2：划水改路径插值后单笔落多滴 → 调小单滴强度，免快划过强
  dropClick: 0.16,
  dropRadius: 0.05,
  specular: 0.5,
  trail: 0.1,
  splash: 0.2,
  ambient: 0.008,
  bobAmp: 0.08,
  bobScale: 1,
  focusMargin: 0.06,
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
