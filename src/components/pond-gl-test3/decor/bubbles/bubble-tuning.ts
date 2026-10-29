/**
 * P20 池塘气泡 / 手记调参（程序化单例，范式同 sphere-tuning / ripple-tuning）。
 * 控制台写、每帧直读，不触发 React 重渲染。布尔量用 0/1；颜色用 #rrggbb。
 * 改动写入 localStorage（try/catch：隐私模式下读写失败不影响运行）。
 */
export const DEFAULT_BUBBLE_TUNING = {
  // ── 生成节奏 ──
  gapMin: 10, gapMax: 30, intervalMult: 1, playingMult: 2,
  countMin: 3, countMax: 6, popGapMin: 0.4, popGapMax: 1.5,
  retryMin: 4, retryMax: 8, maxTries: 5, areaMin: 0.15, areaMax: 0.85,
  // ── 运动 ──
  riseMin: 5, riseMax: 8, speed: 1, riseEase: 0.85, depthStart: 0.05,
  dwellMin: 0.3, dwellMax: 1.2, swayMin: 2, swayMax: 7, swayFreqMin: 0.8, swayFreqMax: 1.6,
  // ── 外观 ──
  size: 1, sizeMin: 0.67, sizeMax: 1.4, radiusDeep: 1.5, radiusSurface: 3.5, radiusCurve: 1.2, minSpritePx: 6,
  opacity: 0.4, colorHex: '#cce5ff', depthDim: 0.45, fadeIn: 0.15,
  ringRadius: 0.3, ringSoftDeep: 0.16, ringSoftSurface: 0.05, ringStrength: 0.55, innerFill: 0.06,
  glintDeep: 0.25, glintSurface: 0.6, glintX: -0.13, glintY: -0.13, glintSize: 0.0016,
  // ── 避让球 ──
  avoidSpawn: 1, avoidFade: 1, discSafety: 1.2, refractMargin: 0.03, edgeBand: 0.06, swayMargin: 10,
  // ── 破水涟漪 ──
  popEnabled: 1, popStrength: 0.04, popRadius: 0.006,
  // ── 手记：出现 ──
  notesEnabled: 1, noteEveryMin: 2, noteEveryMax: 4, suppressPlaying: 1, maxHold: 90,
  // ── 手记：版式 ──
  noteWidth: 360, noteFont: 15, noteLineH: 1.75, noteOpacity: 0.78, noteShadow: 1, noteGap: 18, topSafe: 150, bottomSafe: 120,
  boxOpacity: 0.72, boxBlur: 14, boxAlways: 0,
  // ── 手记：时间 ──
  revealStep: 300, fadeMs: 700, baseStay: 3000, perCharZh: 80, perCharEn: 40, jitter: 0.15, resumeFloor: 3000,
};
export type BubbleTuning = typeof DEFAULT_BUBBLE_TUNING;

const KEY = 'pond-bubble-tuning-v1';
let current: BubbleTuning = { ...DEFAULT_BUBBLE_TUNING };
let loaded = false;
type Burst = 'plain' | 'note' | null;
let burst: Burst = null;

function ensureLoaded(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<BubbleTuning>;
    for (const k of Object.keys(DEFAULT_BUBBLE_TUNING) as Array<keyof BubbleTuning>) {
      if (typeof saved[k] === typeof DEFAULT_BUBBLE_TUNING[k]) (current as Record<string, unknown>)[k] = saved[k];
    }
  } catch { /* 存储不可用或内容损坏：沿用默认值 */ }
}
function persist(): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* 隐私模式 */ }
}

export function getBubbleTuning(): BubbleTuning {
  ensureLoaded();
  return current;
}
export function setBubbleTuning(patch: Partial<BubbleTuning>): void {
  ensureLoaded();
  current = { ...current, ...patch };
  persist();
}
export function resetBubbleTuning(): void {
  current = { ...DEFAULT_BUBBLE_TUNING };
  persist();
}
/** 控制台"立即冒一串"：下一帧生成（note = 带手记）。模拟每帧取走。 */
export function requestBurst(kind: 'plain' | 'note'): void { burst = kind; }
export function takeBurst(): Burst { const b = burst; burst = null; return b; }
