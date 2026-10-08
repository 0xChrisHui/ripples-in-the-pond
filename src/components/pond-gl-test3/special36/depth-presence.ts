/**
 * 第36特殊圆 — 主动换层 + 隐现两台状态机（各自随机时钟，互不同步）。
 *
 * 换层：z∈[0,1] 落在 NUM_LAYERS 档上；跳几档、上浮/下沉、过渡时长与曲线、停留多久全随机，
 *   贴近两端时倾向往回走，可跨过水面线出水/入水。
 * 隐现：可见 → 渐隐（完全消失或只半隐）→ 隐藏 → 渐显；完全隐藏时可能换个位置重现、渐隐时可能顺势下沉。
 */
import { NUM_LAYERS } from '@/src/components/archipelago/sphere-config';
import { chance, clamp, logRand, pickEase, pickWeighted, rand, type Ease } from './random';

const STEP = 1 / (NUM_LAYERS - 1);

export interface LayerState { from: number; to: number; start: number; dur: number; ease: Ease; holdUntil: number }

export function createLayer(z: number, now: number): LayerState {
  return { from: z, to: z, start: now, dur: 1, ease: pickEase(), holdUntil: now + logRand(1, 8) };
}
function levelOf(z: number): number {
  return Math.round(clamp(z, 0, 1) / STEP);
}
/** 发起一次换层；dir 指定时（渐隐下沉）强制方向。 */
function startMove(s: LayerState, current: number, now: number, mood: number, dir?: 1 | -1): void {
  const level = levelOf(current);
  const jump = pickWeighted([[1, 4], [2, 3], [3, 2], [Math.round(rand(4, 6)), 1]] as const);
  // 越靠近端点越倾向往回：z 大 = 层号小 = 近/浮，z 小 = 深/沉
  const up = dir ? dir > 0 : chance(clamp(1 - level / (NUM_LAYERS - 1), 0.12, 0.88));
  const target = clamp(level + (up ? jump : -jump), 0, NUM_LAYERS - 1);
  s.from = current; s.to = target * STEP; s.start = now; s.ease = pickEase();
  s.dur = logRand(1.5, 12) / Math.sqrt(mood);
  s.holdUntil = now + s.dur + logRand(2, 35) / mood;
}
export function sinkLayer(s: LayerState, current: number, now: number, mood: number): void {
  startMove(s, current, now, mood, -1);
}
/** 返回当前 z。 */
export function stepLayer(s: LayerState, now: number, mood: number): number {
  const u = clamp((now - s.start) / s.dur, 0, 1);
  const z = s.from + (s.to - s.from) * s.ease(u);
  if (now >= s.holdUntil) startMove(s, z, now, mood);
  return z;
}

type Phase = 'visible' | 'out' | 'hidden' | 'in';
export interface PresenceState { phase: Phase; elapsed: number; dur: number; from: number; floor: number; value: number; ease: Ease; held: boolean }
export interface PresenceEvents { relocate: boolean; sink: boolean }

export function createPresence(): PresenceState {
  return { phase: 'visible', elapsed: 0, dur: logRand(8, 45), from: 1, floor: 0, value: 1, ease: pickEase(), held: false };
}
function enter(s: PresenceState, phase: Phase, mood: number): void {
  s.phase = phase; s.elapsed = 0; s.from = s.value; s.ease = pickEase();
  if (phase === 'visible') s.dur = logRand(12, 90) / mood;
  else if (phase === 'out') {
    s.floor = chance(0.7) ? 0 : rand(0.15, 0.55);
    s.dur = logRand(0.8, 6);
  } else if (phase === 'hidden') s.dur = s.floor === 0 ? logRand(1.5, 25) : logRand(0.3, 4);
  else s.dur = logRand(0.6, 5);
}
/** held=播放/悬停/拖拽中：快速回到完全可见并暂停计时；松开后重新给一段可见期。 */
export function stepPresence(s: PresenceState, dt: number, held: boolean, mood: number): PresenceEvents {
  const events: PresenceEvents = { relocate: false, sink: false };
  if (held) {
    s.held = true;
    s.value = Math.min(1, s.value + dt / 0.4);
    return events;
  }
  if (s.held) { s.held = false; enter(s, 'visible', mood); s.dur = logRand(4, 30) / mood; }
  s.elapsed += dt;
  if (s.elapsed >= s.dur) {
    const next: Phase = s.phase === 'visible' ? 'out' : s.phase === 'out' ? 'hidden' : s.phase === 'hidden' ? 'in' : 'visible';
    enter(s, next, mood);
    if (next === 'out') events.sink = chance(0.4);
    if (next === 'hidden' && s.floor === 0) events.relocate = chance(0.5);
  }
  const u = s.ease(clamp(s.elapsed / s.dur, 0, 1));
  if (s.phase === 'out') s.value = s.from + (s.floor - s.from) * u;
  else if (s.phase === 'in') s.value = s.from + (1 - s.from) * u;
  else if (s.phase === 'hidden') s.value = s.floor;
  else s.value = 1;
  return events;
}
