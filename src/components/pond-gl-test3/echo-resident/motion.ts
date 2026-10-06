import type { ResidentEchoConfig, ResidentEchoLayout, ResidentMotionState, ResidentPoint, ResidentRandom, ResidentScalarSegment } from '../../../types/echo-resident';
import { contains, resolveResidentBounds } from './render/bounds';
import { sampleRange } from './random';

export function smootherStep(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export function sampleScalar(s: ResidentScalarSegment, time: number): number {
  return s.from + (s.to - s.from) * smootherStep((time - s.start) / s.duration);
}
export function motionPoint(s: ResidentMotionState, time: number): ResidentPoint {
  const u = smootherStep((time - s.drift.start) / s.drift.duration);
  return { x: s.drift.from.x + (s.drift.to.x - s.drift.from.x) * u,
    y: s.drift.from.y + (s.drift.to.y - s.drift.from.y) * u };
}
function layoutKey(l: ResidentEchoLayout): string {
  return JSON.stringify([l.width, l.height, l.safeArea, l.controls, l.baseRadiusPx, l.maxProjectionScale, l.haloRatio]);
}
function nextDrift(from: ResidentPoint, start: number, state: ResidentMotionState, c: ResidentEchoConfig, r: ResidentRandom) {
  const rect = state.bounds.rect;
  const duration = sampleRange(r.drift, c.driftSeconds);
  // 窄屏仍沿充足的纵向空间游移，不让大圆扣除边界后的短边把路线压到几像素。
  const span = Math.max(rect.width, rect.height);
  const distance = Math.min(span * sampleRange(r.drift, c.driftFraction), c.maxDriftPx,
    c.maxSpeedPxPerSecond * duration / 1.875);
  for (let i = 0; i < c.maxCandidates; i++) {
    const angle = r.drift.next() * Math.PI * 2;
    const to = { x: from.x + Math.cos(angle) * distance, y: from.y + Math.sin(angle) * distance };
    if (contains(rect, to)) return { from, to, start, duration };
  }
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const length = Math.hypot(center.x - from.x, center.y - from.y);
  const fraction = length ? Math.min(1, distance / length) : 0;
  return { from, to: { x: from.x + (center.x - from.x) * fraction,
    y: from.y + (center.y - from.y) * fraction }, start, duration };
}
export function createMotionState(l: ResidentEchoLayout, c: ResidentEchoConfig, r: ResidentRandom): ResidentMotionState {
  const bounds = resolveResidentBounds(l, c);
  const center = { x: bounds.rect.x + bounds.rect.width / 2, y: bounds.rect.y + bounds.rect.height / 2 };
  const state: ResidentMotionState = {
    bounds, layoutKey: layoutKey(l), resizeConstrained: false, surface: l.surface,
    drift: { from: center, to: center, start: 0, duration: 1 },
    depth: { from: 0, to: sampleRange(r.depth, c.depthAboveSurface), start: 0,
      duration: sampleRange(r.depth, c.depthCycleSeconds) / 2 },
    scale: { from: 1, to: sampleRange(r.scale, [1, c.breathScale[1]]), start: 0,
      duration: sampleRange(r.scale, c.breathCycleSeconds) / 2 },
    depthRising: true, scaleRising: true,
  };
  state.drift = nextDrift(center, 0, state, c, r);
  return state;
}
/** 拖拽只改平面落点，浮沉/呼吸与独立随机流不受逐次pointermove影响。 */
export function moveMotion(s: ResidentMotionState, point: ResidentPoint, time: number): void {
  const rect = s.bounds.rect;
  const target = { x: Math.max(rect.x, Math.min(rect.x + rect.width, point.x)),
    y: Math.max(rect.y, Math.min(rect.y + rect.height, point.y)) };
  s.drift = { ...s.drift, from: target, to: target, start: time };
}
export function resumeMotion(s: ResidentMotionState, time: number, c: ResidentEchoConfig, r: ResidentRandom): void {
  s.drift = nextDrift(motionPoint(s, time), time, s, c, r);
}
/** resize 保留段时间和随机状态，仅映射同一段的两个端点。 */
export function resizeMotion(s: ResidentMotionState, l: ResidentEchoLayout, c: ResidentEchoConfig, time: number): void {
  if (s.layoutKey === layoutKey(l)) return;
  const point = motionPoint(s, time), old = s.bounds.rect;
  const bounds = resolveResidentBounds(l, c, point), rect = bounds.rect;
  const map = (p: ResidentPoint): ResidentPoint => ({
    x: rect.x + Math.max(0, Math.min(1, old.width ? (p.x - old.x) / old.width : 0.5)) * rect.width,
    y: rect.y + Math.max(0, Math.min(1, old.height ? (p.y - old.y) / old.height : 0.5)) * rect.height,
  });
  s.drift.from = map(s.drift.from); s.drift.to = map(s.drift.to);
  // 放大视口不允许把既有路线拉长到超过峰值速度合同。
  const length = Math.hypot(s.drift.to.x - s.drift.from.x, s.drift.to.y - s.drift.from.y);
  const limit = c.maxSpeedPxPerSecond * s.drift.duration / 1.875;
  if (length > limit) {
    const current = map(point), u = smootherStep((time - s.drift.start) / s.drift.duration);
    const dx = (s.drift.to.x - s.drift.from.x) * limit / length;
    const dy = (s.drift.to.y - s.drift.from.y) * limit / length;
    s.drift.from = { x: current.x - dx * u, y: current.y - dy * u };
    s.drift.to = { x: current.x + dx * (1 - u), y: current.y + dy * (1 - u) };
  }
  s.resizeConstrained = !contains(rect, point) || bounds.sizeClamped;
  s.bounds = bounds; s.layoutKey = layoutKey(l);
}
export function stepMotion(s: ResidentMotionState, time: number, delta: number, surface: number, c: ResidentEchoConfig, r: ResidentRandom): void {
  // 水位变化只缓变基准，播放冻结时 delta=0，不会被滚轮偷偷重写深度。
  if (Number.isFinite(surface)) s.surface += (surface - s.surface) * (1 - Math.exp(-delta));
  if (time >= s.drift.start + s.drift.duration) {
    s.drift = nextDrift(s.drift.to, s.drift.start + s.drift.duration, s, c, r);
  }
  if (time >= s.depth.start + s.depth.duration) {
    s.depthRising = !s.depthRising;
    s.depth = { from: s.depth.to,
      to: s.depthRising ? sampleRange(r.depth, c.depthAboveSurface) : -sampleRange(r.depth, c.depthBelowSurface),
      start: s.depth.start + s.depth.duration, duration: sampleRange(r.depth, c.depthCycleSeconds) / 2 };
  }
  if (time >= s.scale.start + s.scale.duration) {
    s.scaleRising = !s.scaleRising;
    s.scale = { from: s.scale.to, to: sampleRange(r.scale, s.scaleRising ? [1, c.breathScale[1]] : [c.breathScale[0], 1]),
      start: s.scale.start + s.scale.duration, duration: sampleRange(r.scale, c.breathCycleSeconds) / 2 };
  }
}
