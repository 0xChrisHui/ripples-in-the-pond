'use client';

import { K_MIN, LAYER_MIN_FACTOR } from '../../../sphere-config';

/** v57 — 彗星 spawn helper：从 comet-system 抽出（行数硬线 220）*/

export interface Comet {
  id: number;
  sx: number; sy: number;
  cx: number; cy: number;
  ex: number; ey: number;
  z0: number; z1: number;
  spawnTime: number;
  duration: number;
  frozen: boolean;
  frozenT: number;
  eclipse: boolean;
  sizeFactor: number;
  trailSpawnCount: number; // v63 每彗星累计 trail 节点 spawn 数（lifeRate 函数相位）
}

export const MAX_COMETS = 3;
// v74/v86 — SIZE_BASE = 球小球（最远层最小 K）视觉，跟随 K_MIN/LAYER_MIN_FACTOR 自动调整
export const SIZE_BASE = K_MIN * LAYER_MIN_FACTOR;
export const TRAIL_HISTORY = 70;
export const PUSH_RADIUS = 80;
export const Z_REACH = 0.4;     // v58 推球 z 影响范围（之前 0.15 同层级 → 0.4 邻近多层）
export const PUSH_FORCE = 1.4;    // v60 0.7 → 1.4 推力翻倍
export const HOVER_RADIUS = 120;  // v60 90 → 120 hover 减速范围扩大

let nextCometId = 1;

export function spawnComet(
  svgRef: React.RefObject<SVGSVGElement | null>,
  cometsRef: React.RefObject<Comet[]>,
): void {
  const list = cometsRef.current;
  if (!list || list.length >= MAX_COMETS) return;
  const svg = svgRef.current;
  if (!svg) return;
  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 600;
  const M = 100;
  const side = Math.floor(Math.random() * 4);
  let sx = 0, sy = 0, ex = 0, ey = 0;
  if (side === 0) { sx = -M; sy = Math.random() * H; ex = W + M; ey = Math.random() * H; }
  else if (side === 1) { sx = W + M; sy = Math.random() * H; ex = -M; ey = Math.random() * H; }
  else if (side === 2) { sx = Math.random() * W; sy = -M; ex = Math.random() * W; ey = H + M; }
  else { sx = Math.random() * W; sy = H + M; ex = Math.random() * W; ey = -M; }
  const dx = ex - sx, dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const arc = (Math.random() - 0.5) * 1400; // v58 ±700 弧度
  const cx = (sx + ex) / 2 + (-dy / len) * arc;
  const cy = (sy + ey) / 2 + (dx / len) * arc;
  const reverse = Math.random() < 0.5;
  // v58 — duration 跟路径长度走 + 速度随机：方向不再决定快慢（横/纵向同感）
  const speed = 60 + Math.random() * 90;  // 60-150 px/s
  const duration = Math.max(7000, (len / speed) * 1000);
  list.push({
    id: nextCometId++,
    sx, sy, cx, cy, ex, ey,
    // v86 — z 跨度对齐球的 [0, 1] 全跨度（之前 0.1-0.9 跨 0.8，现在 0-1 跨 1.0）
    z0: reverse ? 1.0 : 0.0,
    z1: reverse ? 0.0 : 1.0,
    spawnTime: performance.now(),
    duration,
    frozen: false, frozenT: 0, eclipse: false,
    sizeFactor: 1 + Math.random() * 0.5,
    trailSpawnCount: 0,
  });
}
