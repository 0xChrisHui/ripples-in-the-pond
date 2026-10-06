import type { ResidentEchoConfig, ResidentRange } from '../../../types/echo-resident';

export const RESIDENT_ECHO_DEFAULTS: Readonly<ResidentEchoConfig> = Object.freeze<ResidentEchoConfig>({
  residentConfigVersion: 1, diameterMultiplier: 2,
  breathScale: [0.9, 1.1], breathCycleSeconds: [14, 28],
  driftFraction: [0.08, 0.16], driftSeconds: [9, 16],
  maxDriftPx: 80, maxSpeedPxPerSecond: 6, maxCandidates: 8,
  depthAboveSurface: [0.04, 0.1], depthBelowSurface: [0.04, 0.12],
  depthCycleSeconds: [10, 25], visibleSeconds: [20, 45], hiddenSeconds: [8, 20],
  fadeInSeconds: [1.5, 3], fadeOutSeconds: [1.5, 3], firstDelaySeconds: [0, 1.5],
  interactionProtectionSeconds: [1.5, 3], playbackProtectionSeconds: [3, 6],
  resumeSeconds: [0.6, 1], edgeMarginPx: 16, controlMarginPx: 12,
  focusRingPx: 4, maxDeltaSeconds: 0.05, hitThreshold: 0.15,
});
for (const value of Object.values(RESIDENT_ECHO_DEFAULTS)) if (Array.isArray(value)) Object.freeze(value);
// 保持正圆，只保留普通球的光晕呼吸，时钟由驻留控制器统一冻结。
export const RESIDENT_ECHO_SURFACE = Object.freeze({
  edgeAmp: 0, edgeSpeed: 0, edgeSoft: 0,
  haloBreathAmp: 0.12, haloBreathSpeed: 1 / 18,
});
const ranges = ['breathScale', 'breathCycleSeconds', 'driftFraction', 'driftSeconds',
  'depthAboveSurface', 'depthBelowSurface', 'depthCycleSeconds', 'visibleSeconds',
  'hiddenSeconds', 'fadeInSeconds', 'fadeOutSeconds', 'firstDelaySeconds',
  'interactionProtectionSeconds', 'playbackProtectionSeconds', 'resumeSeconds'] as const;

/** 非法持久参数回到整组默认值，保证不会拼出不可复现的半有效配置。 */
export function validateResidentConfig(input: unknown): {
  valid: boolean; config: Readonly<ResidentEchoConfig>; reasons: readonly string[];
} {
  const reasons: string[] = [];
  if (!input || typeof input !== 'object') return { valid: false, config: RESIDENT_ECHO_DEFAULTS, reasons: ['配置不是对象'] };
  const values = input as Record<string, unknown>;
  for (const name of ranges) {
    const range = values[name];
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite)
      || range[0] < 0 || range[0] > range[1]
      || (name !== 'firstDelaySeconds' && range[0] === 0)) reasons.push(`${name} 范围无效`);
  }
  for (const [name, fallback] of Object.entries(RESIDENT_ECHO_DEFAULTS)) {
    if (typeof fallback !== 'number') continue;
    const v = values[name];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) reasons.push(`${name} 必须为有限正数`);
  }
  if (values.residentConfigVersion !== 1) reasons.push('配置版本不匹配');
  if (values.diameterMultiplier !== 2) reasons.push('当前尺寸合同必须为直径 2 倍');
  for (const name of ['driftFraction', 'depthAboveSurface', 'depthBelowSurface'] as const) {
    const range = values[name];
    if (Array.isArray(range) && range[1] > 1) reasons.push(`${name} 超出归一化域`);
  }
  const breath = values.breathScale;
  if (Array.isArray(breath) && (breath[0] < 0.9 || breath[1] > 1.1)) reasons.push('呼吸超出 0.9–1.1');
  if (typeof values.hitThreshold === 'number' && values.hitThreshold > 1) reasons.push('命中阈值超出透明度域');
  if (typeof values.maxDeltaSeconds === 'number' && values.maxDeltaSeconds > 0.05) reasons.push('单帧增量超过 50ms');
  if (typeof values.maxCandidates === 'number' && (!Number.isInteger(values.maxCandidates) || values.maxCandidates > 8)) reasons.push('候选数必须为 1–8 的整数');
  if (typeof values.maxSpeedPxPerSecond === 'number' && values.maxSpeedPxPerSecond > 6) reasons.push('峰值速度超过 6px/s');
  if (reasons.length) return { valid: false, config: RESIDENT_ECHO_DEFAULTS, reasons };
  const config = { ...input } as ResidentEchoConfig;
  for (const name of ranges) config[name] = Object.freeze([...(values[name] as ResidentRange)]) as ResidentRange;
  return { valid: true, config: Object.freeze(config), reasons };
}
