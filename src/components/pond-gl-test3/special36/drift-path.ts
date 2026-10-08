/**
 * 第36特殊圆 — 屏幕空间漂流路径。
 *
 * 坐标 = 安全区内归一化 [0,1]²（每帧再映射成像素，resize 不断路）。
 * 每段 = 三次贝塞尔 + 可选横向蜿蜒叠加：直线/单弧/S 形/钩形/顺滑承接/原地停顿全部由同一结构表达；
 * 距离、速度、缓动、弯曲方向与幅度、转向角、是否停顿都逐段随机；4×4 访问热度让它倾向去没去过的区域。
 */
import { chance, clamp, logRand, pickEase, pickWeighted, rand, sign, type Ease } from './random';

export interface Pt { x: number; y: number }
interface Wobble { amp: number; freq: number; phase: number }
interface Segment { a: Pt; c1: Pt; c2: Pt; b: Pt; wobble: Wobble[]; ease: Ease; start: number; dur: number; pause: boolean }
export interface DriftState { seg: Segment; heading: number; heat: Float32Array }
export interface RectPx { w: number; h: number }

const GRID = 4;
const SAMPLES = 14;

function bezier(s: Segment, u: number): Pt {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return { x: a * s.a.x + b * s.c1.x + c * s.c2.x + d * s.b.x, y: a * s.a.y + b * s.c1.y + c * s.c2.y + d * s.b.y };
}
/** 段内归一化进度 u（未缓动）→ 点；蜿蜒沿弦的法线方向，两端为 0 保证段间连续。 */
function pointAt(s: Segment, u: number, rect: RectPx): Pt {
  const p = bezier(s, s.ease(u));
  if (!s.wobble.length) return p;
  const dx = (s.b.x - s.a.x) * rect.w, dy = (s.b.y - s.a.y) * rect.h;
  const len = Math.hypot(dx, dy) || 1;
  let off = 0;
  for (const w of s.wobble) off += w.amp * Math.sin(2 * Math.PI * w.freq * u + w.phase);
  off *= Math.sin(Math.PI * u) * len;
  return { x: p.x + (-dy / len) * off / rect.w, y: p.y + (dx / len) * off / rect.h };
}
function pathLengthPx(s: Segment, rect: RectPx): { length: number; inside: boolean } {
  let length = 0, inside = true, prev = pointAt(s, 0, rect);
  for (let i = 1; i <= SAMPLES; i++) {
    const p = pointAt(s, i / SAMPLES, rect);
    if (p.x < -0.01 || p.x > 1.01 || p.y < -0.01 || p.y > 1.01) inside = false;
    length += Math.hypot((p.x - prev.x) * rect.w, (p.y - prev.y) * rect.h);
    prev = p;
  }
  return { length, inside };
}
function cellOf(p: Pt): number {
  return clamp(Math.floor(p.y * GRID), 0, GRID - 1) * GRID + clamp(Math.floor(p.x * GRID), 0, GRID - 1);
}
/** 转向分布：顺行 / 偏转 / 大转 / 掉头 / 完全随机。 */
function nextHeading(prev: number): number {
  const kind = pickWeighted([['keep', 3], ['veer', 3], ['turn', 2], ['back', 1], ['any', 1.2]] as const);
  if (kind === 'any') return rand(0, Math.PI * 2);
  const [lo, hi] = kind === 'keep' ? [0, 25] : kind === 'veer' ? [25, 75] : kind === 'turn' ? [75, 140] : [150, 210];
  return prev + sign() * rand(lo, hi) * Math.PI / 180;
}
/** 曲线形状：控制点相对弦的布置决定直/弧/S/钩，承接型沿上一段切线出发（无折角）。 */
function shape(a: Pt, b: Pt, heading: number, rect: RectPx): Pick<Segment, 'c1' | 'c2' | 'wobble'> {
  const vx = b.x - a.x, vy = b.y - a.y;
  // 法线在像素空间算，再折回归一化，保证弯曲方向不被宽高比扭歪
  const px = -vy * rect.h / rect.w, py = vx * rect.w / rect.h;
  const along = (t: number, k: number) => ({ x: a.x + vx * t + px * k, y: a.y + vy * t + py * k });
  const kind = pickWeighted([['line', 2], ['arc', 3], ['s', 2.2], ['hook', 1], ['smooth', 2.5], ['wander', 2]] as const);
  const wobble: Wobble[] = [];
  if (kind === 'wander' || chance(0.18)) {
    const n = 1 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) wobble.push({ amp: rand(0.03, 0.16) / n, freq: rand(0.5, 3.5), phase: rand(0, Math.PI * 2) });
  }
  if (kind === 'line' || kind === 'wander') return { c1: along(1 / 3, 0), c2: along(2 / 3, 0), wobble };
  if (kind === 'arc') {
    const k = sign() * rand(0.15, 0.75);
    return { c1: along(rand(0.15, 0.45), k), c2: along(rand(0.55, 0.85), k * rand(0.6, 1.3)), wobble };
  }
  if (kind === 's') {
    const k = rand(0.2, 0.7), s = sign();
    return { c1: along(rand(0.2, 0.45), s * k), c2: along(rand(0.55, 0.8), -s * k * rand(0.5, 1.4)), wobble };
  }
  const len = Math.hypot(vx * rect.w, vy * rect.h);
  const out = (angle: number, m: number) => ({ x: Math.cos(angle) * len * m / rect.w, y: Math.sin(angle) * len * m / rect.h });
  if (kind === 'hook') {
    const o1 = out(Math.atan2(vy * rect.h, vx * rect.w) + sign() * rand(1, 2.4), rand(0.5, 1.2));
    const o2 = out(Math.atan2(vy * rect.h, vx * rect.w) + sign() * rand(1, 2.4), rand(0.3, 0.9));
    return { c1: { x: a.x + o1.x, y: a.y + o1.y }, c2: { x: b.x + o2.x, y: b.y + o2.y }, wobble };
  }
  const o1 = out(heading, rand(0.2, 0.6));
  return { c1: { x: a.x + o1.x, y: a.y + o1.y }, c2: along(rand(0.5, 0.85), sign() * rand(0, 0.35)), wobble };
}
function pauseSegment(a: Pt, start: number, mood: number, rect: RectPx): Segment {
  // 停而不死：原地一个极小的随机回环
  const r = rand(1, 6), t = rand(0, Math.PI * 2);
  const c1 = { x: a.x + Math.cos(t) * r / rect.w, y: a.y + Math.sin(t) * r / rect.h };
  const c2 = { x: a.x + Math.cos(t + rand(1, 3)) * r / rect.w, y: a.y + Math.sin(t + rand(1, 3)) * r / rect.h };
  return { a, c1, c2, b: a, wobble: [], ease: pickEase(), start, dur: logRand(0.6, 9) / mood, pause: true };
}

function planSegment(state: DriftState | null, from: Pt, start: number, mood: number, rect: RectPx): Segment {
  const prevHeading = state?.heading ?? rand(0, Math.PI * 2);
  if (state && !state.seg.pause && chance(clamp(0.1 + 0.22 * (1 / mood - 0.5), 0.05, 0.45))) {
    return pauseSegment(from, start, mood, rect);
  }
  const diag = Math.hypot(rect.w, rect.h);
  let best: Segment | null = null, bestScore = -Infinity;
  for (let i = 0; i < 10; i++) {
    const heading = i < 7 ? nextHeading(prevHeading) : rand(0, Math.PI * 2);
    const dist = logRand(25, Math.max(40, diag * 0.75)) * (i < 7 ? 1 : 0.5);
    const b = { x: from.x + Math.cos(heading) * dist / rect.w, y: from.y + Math.sin(heading) * dist / rect.h };
    if (b.x < 0 || b.x > 1 || b.y < 0 || b.y > 1) continue;
    const seg: Segment = { a: from, b, ...shape(from, b, prevHeading, rect), ease: pickEase(), start, dur: 1, pause: false };
    const { length, inside } = pathLengthPx(seg, rect);
    if (!inside) continue;
    const novelty = state ? 1 - state.heat[cellOf(b)] : 1;
    const score = Math.random() + novelty * 0.9;
    if (score > bestScore) { bestScore = score; best = { ...seg, dur: clamp(length / (logRand(9, 60) * mood), 1.2, 45) }; }
  }
  if (best) return best;
  // 全部候选越界（极窄屏/贴边）→ 直线回安全区内一个随机点
  const b = { x: rand(0.3, 0.7), y: rand(0.3, 0.7) };
  const seg: Segment = { a: from, b, c1: from, c2: b, wobble: [], ease: pickEase(), start, dur: 1, pause: false };
  return { ...seg, dur: clamp(pathLengthPx(seg, rect).length / (rand(10, 40) * mood), 1.5, 30) };
}

export function createDrift(from: Pt, nowSec: number, mood: number, rect: RectPx): DriftState {
  return { seg: planSegment(null, from, nowSec, mood, rect), heading: rand(0, Math.PI * 2), heat: new Float32Array(GRID * GRID) };
}
/** 从任意位置重新起一段（拖拽松手 / 隐身换位后）。 */
export function replanDrift(s: DriftState, from: Pt, nowSec: number, mood: number, rect: RectPx): void {
  s.seg = planSegment(s, from, nowSec, mood, rect);
}
/** 推进并返回当前归一化目标点。 */
export function stepDrift(s: DriftState, nowSec: number, dt: number, mood: number, rect: RectPx): Pt {
  if (nowSec >= s.seg.start + s.seg.dur) {
    const end = s.seg.b;
    if (!s.seg.pause) {
      const tail = pointAt(s.seg, 0.97, rect);
      s.heading = Math.atan2((end.y - tail.y) * rect.h, (end.x - tail.x) * rect.w);
    }
    s.seg = planSegment(s, end, nowSec, mood, rect);
  }
  const decay = Math.exp(-dt / 40);
  for (let i = 0; i < s.heat.length; i++) s.heat[i] *= decay;
  const p = pointAt(s.seg, clamp((nowSec - s.seg.start) / s.seg.dur, 0, 1), rect);
  const cell = cellOf(p);
  s.heat[cell] = Math.min(1, s.heat[cell] + dt * 0.08);
  return { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
}
