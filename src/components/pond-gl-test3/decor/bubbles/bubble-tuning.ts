/**
 * P20 池塘气泡 / 手记参数（程序化单例，范式同 sphere-tuning / ripple-tuning）。
 * 分两部分：TUNABLE（约 36 项）进 /test5 控制台、可写 localStorage；FIXED 是定稿的固定值，只在代码里改。
 * 控制台写、每帧直读，不触发 React 重渲染。布尔量用 0/1；颜色用 #rrggbb。
 * 本地存储只在 /test5 打开控制台时读写（enableTuningStorage）；正式页面永远只用这里的默认值。
 */
const TUNABLE = {
  // ── 生成节奏 ──
  meanGroups: 1.5, maxGroups: 4, spread: 0.85, playingGroupsMult: 0.5, keepFull: 0, countMin: 5, countMax: 8,
  // ── 运动 ──
  riseMin: 5, riseMax: 8, speed: 2, driftFrac: 0.17, swayMax: 7,
  // ── 外观 ──
  size: 1.5, leadBig: 1, sizeSpeed: 0.8, birthSpread: 14, radiusDeep: 1.5, radiusSurface: 3.5,
  opacity: 0.4, colorHex: '#cce5ff', depthDim: 0.45,
  // ── 避让球 ──
  avoidSpawn: 1, avoidFade: 1,
  // ── 破水涟漪 ──
  popEnabled: 1, popStrength: 0.04, popSwell: 0.15,
  // ── 手记 ──
  notesEnabled: 1, noteEveryMin: 2, noteEveryMax: 4, suppressPlaying: 1,
  noteWidth: 360, noteFont: 13.5, noteOpacity: 0.6, boxOpacity: 0.72, baseStay: 3000, fadeMs: 700,
};
const FIXED = {
  popGapMin: 0.4, popGapMax: 1.5, candidates: 8, areaMin: 0.15, areaMax: 0.85,
  riseEase: 0.85, dwellMin: 0.3, dwellMax: 1.2, swayMin: 2, swayFreqMin: 0.8, swayFreqMax: 1.6,
  sizeMin: 0.5, sizeMax: 1.6, radiusCurve: 1, minSpritePx: 6, fadeIn: 0.15,
  ringRadius: 0.3, ringSoftDeep: 0.16, ringSoftSurface: 0.05, ringStrength: 0.6, innerFill: 0.1,
  glintDeep: 0.43, glintSurface: 0.6, glintX: -0.13, glintY: -0.13, glintSize: 0.0016,
  discSafety: 1.2, refractMargin: 0.03, edgeBand: 0.06,
  popRadius: 0.006, popTime: 0.15, maxHold: 90,
  noteLineH: 1.75, noteShadow: 1, noteGap: 18, topSafe: 150, bottomSafe: 120, boxBlur: 14, boxAlways: 0,
  revealStep: 300, perCharZh: 80, perCharEn: 40, jitter: 0.15, resumeFloor: 3000,
};
export const DEFAULT_BUBBLE_TUNING = { ...FIXED, ...TUNABLE };
export type BubbleTuning = typeof DEFAULT_BUBBLE_TUNING;
export type TunableKey = keyof typeof TUNABLE;
export const TUNABLE_KEYS = Object.keys(TUNABLE) as TunableKey[];

const KEY = 'pond-bubble-tuning-v1';
let current: BubbleTuning = { ...DEFAULT_BUBBLE_TUNING };
let storageOn = false;
type Burst = 'plain' | 'note' | null;
let burst: Burst = null;

/** 控制台按钮与状态行的数据源：立即请求 → 排队 → 进行中 / 没有空位；手记 → 泡在水面 → 显示中。 */
export interface UiState {
  burst: 'idle' | 'queued' | 'running' | 'failed';
  kind: 'plain' | 'note' | null;
  note: 'idle' | 'surface' | 'showing';
}
let uiSnap: UiState = { burst: 'idle', kind: null, note: 'idle' };
const uiListeners = new Set<() => void>();
export function getUiState(): UiState { return uiSnap; }
export function subscribeUi(l: () => void): () => void {
  uiListeners.add(l);
  return () => { uiListeners.delete(l); };
}
/** 只在值真的变化时换新快照并通知，避免每帧触发重渲染。 */
export function setUiState(patch: Partial<UiState>): void {
  const next = { ...uiSnap, ...patch };
  if (next.burst === uiSnap.burst && next.kind === uiSnap.kind && next.note === uiSnap.note) return;
  uiSnap = next;
  uiListeners.forEach((l) => l());
}

/** 只有 /test5 的控制台调用：读出已存的调参并开启写入。正式页面不调用 → 不读不写，只用默认值。 */
export function enableTuningStorage(): void {
  if (storageOn || typeof window === 'undefined') return;
  storageOn = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<BubbleTuning>;
    const next = { ...current };
    for (const k of TUNABLE_KEYS) {
      if (typeof saved[k] === typeof DEFAULT_BUBBLE_TUNING[k]) (next as Record<string, unknown>)[k] = saved[k];
    }
    current = next;
  } catch { /* 存储不可用或内容损坏：沿用默认值 */ }
}
function persist(): void {
  if (!storageOn) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(TUNABLE_KEYS.map((k) => [k, current[k]]))));
  } catch { /* 隐私模式 */ }
}

export function getBubbleTuning(): BubbleTuning {
  return current;
}
export function setBubbleTuning(patch: Partial<BubbleTuning>): void {
  current = { ...current, ...patch };
  persist();
}
export function resetBubbleTuning(): void {
  current = { ...DEFAULT_BUBBLE_TUNING };
  persist();
}
/** 控制台"立即冒一串 / 出手记"：下一帧生成（note = 带手记）。模拟每帧取走。 */
export function requestBurst(kind: 'plain' | 'note'): void {
  burst = kind;
  setUiState({ burst: 'queued', kind });
}
export function takeBurst(): Burst { const b = burst; burst = null; return b; }
