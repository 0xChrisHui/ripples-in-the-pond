'use client';

/**
 * P8-L 生命感参数 store（范式同 ripple-tuning：单例 + pub/sub + localStorage）。
 *
 * L 线各生命感模块每帧读 getLifeTuning() 取幅度/频率/衰减等系数；LifePanel 用 useSyncExternalStore
 * 订阅渲染滑块。localStorage key = 'test3-life-v2'（无 legacy 迁移，直接 load 默认+存档）。
 * 默认值由用户在 /test3 调参并保存后的视觉定稿同步而来；localStorage 仍优先覆盖默认值。
 */
export interface LifeTuning {
  lifeEnvAmount: number;   // 全局呼吸包络深度（0=恒1无呼吸；乘在所有无序项幅度上）
  lifeEnvPeriod: number;   // 全局呼吸周期（秒）
  wheelAmpVar: number;     // 滚轮升降·每球幅度差
  wheelLagVar: number;     // 滚轮升降·每球时滞差
  parVarAmp: number;       // 鼠标视差·每球幅度差
  parVarAngle: number;     // 鼠标视差·每球方向偏转（弧度）
  flowStrength: number;    // 流场游移·力度
  flowScale: number;       // 流场空间尺度（越小暗流越大团）
  flowSpeed: number;       // 流场演化速度
  shiverInterval: number;  // 偶发颤动·平均间隔（秒）
  shiverAmp: number;       // 偶发颤动·幅度（×半径）
  edgeWaveAmp: number;     // 能量球边缘波·幅度
  edgeWaveFreq: number;    // 能量球边缘波·波数（整数）
  edgeWaveSpeed: number;   // 能量球边缘波·转速
  edgeSoft: number;        // 能量球边缘·虚化
  exciteGain: number;      // 扰动激励·增益
  exciteDecay: number;     // 扰动激励·衰减时间常数（秒）
  jellyAmount: number;     // 果冻感·拉伸量
  wakeSphereForce: number; // 尾波扰动水下球·推力
  wakeDepthFalloff: number;// 尾波推力随深度衰减深
  flickerAmount: number;   // 透明度时隐时现·幅度
  flickerSpeed: number;    // 透明度时隐时现·速度
  flickerDepthBias: number;// 隐现·深度加权（水下更隐）
  haloBreathAmp: number;   // 光晕呼吸·幅度
  haloBreathSpeed: number; // 光晕呼吸·速度
}

/** 用户 2026-08-25 在 /test3 保存的生命感定稿参数。 */
export const DEFAULT_LIFE_TUNING: LifeTuning = {
  lifeEnvAmount: 0.6,
  lifeEnvPeriod: 60,
  wheelAmpVar: 0.6,
  wheelLagVar: 0.8,
  parVarAmp: 1,
  parVarAngle: 0.55,
  flowStrength: 0.275,
  flowScale: 0.02,
  flowSpeed: 0.23,
  shiverInterval: 5,
  shiverAmp: 0.08,
  edgeWaveAmp: 0.1,
  edgeWaveFreq: 3,
  edgeWaveSpeed: 1.1,
  edgeSoft: 0,
  exciteGain: 2.45,
  exciteDecay: 3,
  jellyAmount: 0.02,
  wakeSphereForce: 0.08,
  wakeDepthFalloff: 0.98,
  flickerAmount: 0.84,
  flickerSpeed: 0.05,
  flickerDepthBias: 0,
  haloBreathAmp: 0.5,
  haloBreathSpeed: 0.31,
};

// v2：参数已进入视觉定稿，换键避免旧的全零存档覆盖新版默认。
const KEY = 'test3-life-v2';

function load(): LifeTuning {
  if (typeof window === 'undefined') return { ...DEFAULT_LIFE_TUNING };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_LIFE_TUNING };
    return { ...DEFAULT_LIFE_TUNING, ...(JSON.parse(raw) as Partial<LifeTuning>) };
  } catch {
    return { ...DEFAULT_LIFE_TUNING };
  }
}

let current: LifeTuning = load();
const listeners = new Set<() => void>();

/** 每帧读（稳定引用，setLifeTuning 才换新对象 → 触发 re-render） */
export function getLifeTuning(): LifeTuning {
  return current;
}

export function setLifeTuning(patch: Partial<LifeTuning>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeLifeTuning(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** "保存"：当前参数写 localStorage，刷新后保留 */
export function saveLifeTuning(): void {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(current));
}

/** 重置为默认并清除已保存值 */
export function resetLifeTuning(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
  setLifeTuning({ ...DEFAULT_LIFE_TUNING });
}
