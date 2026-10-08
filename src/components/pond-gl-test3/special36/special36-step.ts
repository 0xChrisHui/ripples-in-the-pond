/**
 * 第36特殊圆 — 每帧编排（sphere-frame.writeFrame 开头调用）。
 *
 * 漂流在**屏幕空间**规划（保证整球留在可视区、避开顶栏和分组导航），再按当前深度逆投影成 sim 目标点，
 * 用弹簧速度喂给 d3：碰撞照常生效（能挤开别的球、也会被挤），拖拽/播放/悬停时让位。
 * 写出：n.z（主动换层）、n._presence（隐现 0..1）、n.vx/vy（漂流弹簧）。
 */
import type { GlPhysNode } from '../spheres/simulation/nodes';
import { HALO_R } from '../spheres/sphere-shader';
import { project, unproject, type ProjCtx } from '../sphere-projection';
import { depthOf } from '../pointer-fx';
import { prefersReducedMotion } from '../reduced-motion';
import { createDrift, replanDrift, stepDrift, type DriftState, type Pt, type RectPx } from './drift-path';
import { createLayer, createPresence, sinkLayer, stepLayer, stepPresence, type LayerState, type PresenceState } from './depth-presence';
import { clamp, rand, stepMood } from './random';

/** 第36圆 = 首页加入的已核验 Echo 节点。 */
export function isSpecial36(n: Pick<GlPhysNode, 'echo'>): boolean {
  return n.echo != null;
}
/** 低于此可见度视为隐藏：不可点击、不可 Tab。 */
export const SPECIAL36_HIT_MIN = 0.35;

const TOP = 84, EDGE = 16;                  // 顶栏高度 / 四边留白
const NAV = { right: 132, bottom: 230 };     // 左上分组导航占位（GlNav: left-6 top-24）
const SPRING = 0.12;
const SPRING_MAX = 3;                        // 每帧弹簧推力上限(px)：拖拽松手/边界变化时不瞬移
const NAV_BAND = 60;                         // 导航避让渐入带(px)：纵向穿过时横向平滑让开

interface State { drift: DriftState; layer: LayerState; presence: PresenceState; clock: number; last: number; dragging: boolean }
const states = new WeakMap<GlPhysNode, State>();

interface Frame { left: number; top: number; rect: RectPx; r: number }
function frameFor(n: GlPhysNode, proj: ProjCtx): Frame {
  const scale = project(proj.cx, proj.cy, depthOf(n), proj).scale;
  const r = n.radius * HALO_R * scale * 1.12;
  const w = proj.cx * 2, h = proj.cy * 2;
  const left = EDGE + r, top = TOP + r;
  return { left, top, r, rect: { w: Math.max(1, w - EDGE - r - left), h: Math.max(1, h - EDGE - r - top) } };
}
function toScreen(p: Pt, f: Frame): Pt {
  let x = f.left + p.x * f.rect.w;
  const y = f.top + p.y * f.rect.h;
  // 避开分组导航：越深入导航高度带，越把 x 推到导航右侧（smoothstep 渐入，无折角）
  const k = clamp((NAV.bottom + NAV_BAND - (y - f.r)) / NAV_BAND, 0, 1);
  const minX = Math.min(NAV.right + f.r, f.left + f.rect.w);
  if (x < minX) x += (minX - x) * k * k * (3 - 2 * k);
  return { x, y };
}
function toNormalized(n: GlPhysNode, proj: ProjCtx, f: Frame): Pt {
  const p = project(n.x ?? proj.cx, n.y ?? proj.cy, depthOf(n), { ...proj, mx: 0, my: 0 });
  return { x: clamp((p.sx - f.left) / f.rect.w, 0, 1), y: clamp((p.sy - f.top) / f.rect.h, 0, 1) };
}
function toSim(n: GlPhysNode, screen: Pt, proj: ProjCtx): Pt {
  return unproject(screen.x, screen.y, depthOf(n), { ...proj, mx: 0, my: 0 }, n);
}

/** 每帧推进第36圆；没有第36圆时立即返回。 */
export function stepSpecial36(nodes: GlPhysNode[], proj: ProjCtx, nowMs: number, focusedId: string | null, hoverId: string | null): void {
  const n = nodes.find(isSpecial36);
  if (!n || n.x == null || n.y == null) return;
  const now = nowMs / 1000;
  if (prefersReducedMotion()) { n._presence = 1; return; }
  let s = states.get(n);
  if (!s) {
    const f = frameFor(n, proj);
    s = { drift: createDrift(toNormalized(n, proj, f), 0, 1, f.rect), layer: createLayer(n.z, 0),
      presence: createPresence(), clock: 0, last: now, dragging: false };
    states.set(n, s);
  }
  const dt = clamp(now - s.last, 0, 0.1);
  s.last = now;
  const mood = stepMood(now, dt);
  const playing = n.id === focusedId;
  const dragged = n.fx != null || n.fy != null;

  const events = stepPresence(s.presence, dt, playing || dragged || n.id === hoverId, mood);
  n._presence = s.presence.value;

  if (dragged) { s.dragging = true; return; }
  if (playing) return; // 播放中冻结主动运动，日食稳定跟随
  s.clock += dt;
  if (events.sink) sinkLayer(s.layer, n.z, s.clock, mood);
  n.z = stepLayer(s.layer, s.clock, mood);

  const f = frameFor(n, proj);
  if (s.dragging) { s.dragging = false; replanDrift(s.drift, toNormalized(n, proj, f), s.clock, mood, f.rect); }
  if (events.relocate) {
    // 完全隐身时换个地方、换个层再出现
    const z = Math.round(rand(0, 9)) / 9;
    s.layer.from = z; s.layer.to = z; n.z = z;
    const spot = { x: rand(0.05, 0.95), y: rand(0.05, 0.95) };
    const sim = toSim(n, toScreen(spot, frameFor(n, proj)), proj);
    n.x = sim.x; n.y = sim.y; n.vx = 0; n.vy = 0;
    replanDrift(s.drift, spot, s.clock, mood, f.rect);
  }
  const target = toSim(n, toScreen(stepDrift(s.drift, s.clock, dt, mood, f.rect), f), proj);
  const ax = (target.x - n.x) * SPRING, ay = (target.y - n.y) * SPRING;
  const cap = Math.min(1, SPRING_MAX / (Math.hypot(ax, ay) || 1));
  n.vx = (n.vx ?? 0) + ax * cap;
  n.vy = (n.vy ?? 0) + ay * cap;
}

/** 绘制顺序：其余球保持建点时的 z 升序，第36圆按当前 z 插入（远先画）。 */
export function fillDrawOrder(nodes: GlPhysNode[], order: number[]): void {
  order.length = 0;
  let special = -1;
  for (let i = 0; i < nodes.length; i++) {
    if (isSpecial36(nodes[i])) special = i;
    else order.push(i);
  }
  if (special < 0) return;
  const z = nodes[special].z;
  let at = order.findIndex((i) => nodes[i].z > z);
  if (at < 0) at = order.length;
  order.splice(at, 0, special);
}
