'use client';

import { Vector4, type ShaderMaterial } from 'three';
import { getSubmerge } from './water-level';
import { MAX_DROPS } from './spike/ripple-spike-shaders';
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

const prevSub = new Map<string, number>();                    // 上帧没入程度（检测穿越）
const trailAt = new Map<string, { x: number; y: number }>();  // 上次落尾迹的 sim 坐标
let ambientFrame = 0;

/** 切组 / 重建节点时清状态：避免旧球的没入记忆触发假穿越溅起 */
export function resetRippleFeed(): void {
  prevSub.clear();
  trailAt.clear();
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

/** 常驻微波：每 ~14 帧在随机处落一滴极轻的水让塘面始终有细腻波动（ambient=0 关） */
export function collectAmbientDrop(t: RippleTuning): Drop | null {
  ambientFrame++;
  if (t.ambient <= 0 || ambientFrame % 14 !== 0) return null;
  return { ux: Math.random(), uy: Math.random(), radius: t.dropRadius * 1.3, strength: t.ambient };
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
