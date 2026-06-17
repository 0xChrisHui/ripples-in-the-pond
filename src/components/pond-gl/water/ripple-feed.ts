'use client';

import { Vector4, type ShaderMaterial } from 'three';
import { getSubmerge } from './water-level';
import { MAX_DROPS } from './spike/ripple-spike-shaders';
import { prefersReducedMotion } from '../reduced-motion';
import type { RippleTuning } from './spike/ripple-tuning';
import type { GlPhysNode } from '../spheres/gl-sim-setup';

/**
 * H4 — 对象喂涟漪（拖球尾迹 + 球穿过水面溅起 + 单帧 >6 合并限流 + 常驻微波）。
 *
 * 全部汇成统一「滴水」(uv.x, uv.y, 半径, 强度)，喂给 WaterDistort 的 ping-pong sim `uDrops` 数组。
 * per-node 跨帧状态（上帧没入程度 / 上次尾迹落点）放模块级 Map（避 react-hooks/immutability +
 * 需跨帧记忆）；切组重建节点时用 resetRippleFeed 清，免旧球的没入记忆触发假穿越。
 */

export interface Drop { ux: number; uy: number; radius: number; strength: number }

const CROSS = 0.5;     // 没入程度穿过此阈值（升/降水位扫过球）= 穿越水面 → 溅起
const TRAIL_MIN = 16;  // 拖拽位移超过此像素才落一滴尾迹（节流，免拖动时水花风暴）
const MERGE_OVER = 6;  // 单帧穿越数 >6 → 合并成一道大涟漪（限流，验收"无水花风暴"）

const PATH_STEP_FRAC = 0.45; // K2 指针落点间距 = 滴水半径(像素)×此值（<1 → 相邻滴重叠成连续水痕）
const PATH_MAX_STEPS = 8;    // K2 单次 move 最多补几滴（防快速跳变刷爆 MAX_DROPS、限 streak 长度）

const prevSub = new Map<string, number>();                    // 上帧没入程度（检测穿越）
const trailAt = new Map<string, { x: number; y: number }>();  // 上次落尾迹的 sim 坐标
let ambientFrame = 0;
let lastPointer: { x: number; y: number } | null = null;      // K2 指针上次落点（路径插值用）

/** 切组 / 重建节点时清状态：避免旧球的没入记忆触发假穿越溅起 */
export function resetRippleFeed(): void {
  prevSub.clear();
  trailAt.clear();
  lastPointer = null;
}

/** 新一笔划水开始（pointerdown）→ 清上次落点，避免新笔从旧位置连出一道长线 */
export function resetPointerPath(): void {
  lastPointer = null;
}

/** sim 像素坐标(y 向下) → 高度场 uv(y 向上，匹配 quad vUv) */
function toUv(x: number, y: number, w: number, h: number): [number, number] {
  return [x / w, 1 - y / h];
}

/** 拖球尾迹：被拖的球（fx/fy 锁定）每移动 TRAIL_MIN 像素落一滴，连成一道尾迹 */
function trailDrops(nodes: GlPhysNode[], w: number, h: number, t: RippleTuning): Drop[] {
  const out: Drop[] = [];
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    if (n.fx == null || n.fy == null) { trailAt.delete(n.id); continue; } // 未拖：清记忆，下次重新起手
    const last = trailAt.get(n.id);
    if (last && Math.hypot(n.x - last.x, n.y - last.y) < TRAIL_MIN) continue;
    trailAt.set(n.id, { x: n.x, y: n.y });
    const [ux, uy] = toUv(n.x, n.y, w, h);
    out.push({ ux, uy, radius: t.dropRadius, strength: t.trail });
  }
  return out;
}

/** 穿越溅起：球没入程度穿过 0.5 → 溅一滴；单帧 >6 颗穿越合并成一道大涟漪（防水花风暴） */
function splashDrops(nodes: GlPhysNode[], w: number, h: number, t: RippleTuning): Drop[] {
  const crossed: { x: number; y: number }[] = [];
  for (const n of nodes) {
    const sub = getSubmerge(n.z);
    const prev = prevSub.get(n.id);
    prevSub.set(n.id, sub);
    if (prev == null || n.x == null || n.y == null) continue;   // 首帧/重建后只建基线，不溅
    if ((prev < CROSS) !== (sub < CROSS)) crossed.push({ x: n.x, y: n.y });
  }
  if (crossed.length === 0) return [];
  if (crossed.length > MERGE_OVER) {                            // 合并限流：一道大涟漪盖住整片
    let sx = 0, sy = 0;
    for (const c of crossed) { sx += c.x; sy += c.y; }
    const [ux, uy] = toUv(sx / crossed.length, sy / crossed.length, w, h);
    return [{ ux, uy, radius: t.dropRadius * 3, strength: t.splash * 1.6 }];
  }
  return crossed.map((c) => {
    const [ux, uy] = toUv(c.x, c.y, w, h);
    return { ux, uy, radius: t.dropRadius * 1.4, strength: t.splash };
  });
}

/** 对象喂涟漪总入口：拖球尾迹 + 穿越溅起（含 >6 合并） */
export function collectObjectDrops(nodes: GlPhysNode[], w: number, h: number, t: RippleTuning): Drop[] {
  return [...trailDrops(nodes, w, h, t), ...splashDrops(nodes, w, h, t)];
}

/** 常驻微波：每 ~24 帧落一滴「宽而轻」的水 → 缓慢大尺度起伏（swell）而非密集小点阵
 *  （小而频的微波在高折射下会被放大成点阵/麻点）。ambient=0 或 reduced-motion 时关。 */
export function collectAmbientDrop(t: RippleTuning): Drop | null {
  ambientFrame++;
  if (t.ambient <= 0 || prefersReducedMotion() || ambientFrame % 24 !== 0) return null;
  return { ux: Math.random(), uy: Math.random(), radius: t.dropRadius * 2.4, strength: t.ambient };
}

/** K2 指针划水路径插值：上次落点→当前点按距离补几滴小水，点连成线（替代旧的 16ms 时间节流单点）。
 *  按位移触发（没动够一格不落、不更新落点 → 小位移累积）；快划自然落更多滴 → 总能量随速度增、连续不"咚咚"。 */
export function pointerPathDrops(x: number, y: number, w: number, h: number, t: RippleTuning): Drop[] {
  const prev = lastPointer;
  if (!prev) {
    lastPointer = { x, y };
    const [ux, uy] = toUv(x, y, w, h);
    return [{ ux, uy, radius: t.dropRadius, strength: t.dropMove }];
  }
  const dx = x - prev.x, dy = y - prev.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(4, t.dropRadius * h * PATH_STEP_FRAC); // 间距随滴水半径（屏上纵向度量，与 K1 一致）
  if (dist < step) return [];
  lastPointer = { x, y };
  const n = Math.min(PATH_MAX_STEPS, Math.floor(dist / step));
  const out: Drop[] = [];
  for (let i = 1; i <= n; i++) {
    const [ux, uy] = toUv(prev.x + dx * (i / n), prev.y + dy * (i / n), w, h);
    out.push({ ux, uy, radius: t.dropRadius, strength: t.dropMove });
  }
  return out;
}

/** 把本帧汇集的滴水写进 sim 的 uDrops 数组（截断到 MAX_DROPS，多余丢弃） */
export function writeDrops(mat: ShaderMaterial, drops: Drop[], slots: Vector4[]): void {
  const n = Math.min(drops.length, MAX_DROPS);
  for (let i = 0; i < n; i++) {
    const d = drops[i];
    slots[i].set(d.ux, d.uy, d.radius, d.strength);
  }
  mat.uniforms.uDropCount.value = n;
}
