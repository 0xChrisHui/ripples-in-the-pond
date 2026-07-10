'use client';

/**
 * P8-L 生命感参数 store（范式同 ripple-tuning：单例 + pub/sub + localStorage）。
 *
 * L 线各生命感模块每帧读 getLifeTuning() 取幅度/频率/衰减等系数；LifePanel 用 useSyncExternalStore
 * 订阅渲染滑块。localStorage key = 'test3-life'（无 legacy 迁移，直接 load 默认+存档）。
 * 本步（L0a 基建）所有默认值皆中性（幅度类 = 0 → 与改前像素级一致），滑块暂无消费方。
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

/** L0a 基建默认：幅度类全 0（中性 → 像素级现状），仅频率/尺度/衰减取合理常量。 */
export const DEFAULT_LIFE_TUNING: LifeTuning = {
  lifeEnvAmount: 0,        // 全局呼吸包络深度（0=无呼吸）
  lifeEnvPeriod: 24,       // 全局呼吸周期（秒）
  wheelAmpVar: 0,          // 滚轮升降·每球幅度差
  wheelLagVar: 0,          // 滚轮升降·每球时滞差
  parVarAmp: 0,            // 鼠标视差·每球幅度差
  parVarAngle: 0,          // 鼠标视差·每球方向偏转（弧度）
  flowStrength: 0,         // 流场游移·力度
  flowScale: 0.008,        // 流场空间尺度（越小暗流越大团）
  flowSpeed: 0.1,          // 流场演化速度
  shiverInterval: 30,      // 偶发颤动·平均间隔（秒）
  shiverAmp: 0,            // 偶发颤动·幅度（×半径）
  edgeWaveAmp: 0,          // 能量球边缘波·幅度
  edgeWaveFreq: 5,         // 能量球边缘波·波数（整数）
  edgeWaveSpeed: 0.6,      // 能量球边缘波·转速
  edgeSoft: 0,             // 能量球边缘·虚化
  exciteGain: 0,           // 扰动激励·增益
  exciteDecay: 0.8,        // 扰动激励·衰减时间常数（秒）
  jellyAmount: 0,          // 果冻感·拉伸量
  wakeSphereForce: 0,      // 尾波扰动水下球·推力
  wakeDepthFalloff: 0.46,  // 尾波推力随深度衰减深
  flickerAmount: 0,        // 透明度时隐时现·幅度
  flickerSpeed: 0.2,       // 透明度时隐时现·速度
  flickerDepthBias: 0,     // 隐现·深度加权（水下更隐）
  haloBreathAmp: 0,        // 光晕呼吸·幅度
  haloBreathSpeed: 0.3,    // 光晕呼吸·速度
};

// /test3 专属键（无 legacy 迁移；直接 load 默认+存档）。
const KEY = 'test3-life';

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
