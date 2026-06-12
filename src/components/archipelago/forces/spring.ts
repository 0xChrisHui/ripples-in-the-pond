/**
 * Lane C 物理线 — 欠阻尼弹簧（半隐式欧拉）
 *
 * 受涟漪/微风推开的球回归 anchor 时，用弹簧替代 d3 纯 forceX/Y 的指数拉回，
 * 让回归带"过冲—回摆"的水感（受扰必回摆）。ζ≈0.3-0.5 欠阻尼，回摆 1-2 次后稳定。
 *
 * 半隐式欧拉：先更新速度再用新速度更新位置，比显式欧拉稳定，低频步长不易发散。
 * 💭 为什么不用 d3 forceX/forceY：那是指数衰减无过冲，回归"硬贴"无水感。
 */

// k=刚度 / c=阻尼 / mass=1 → ζ = c / (2√(k·m)) ≈ 6/(2√60) ≈ 0.39（欠阻尼）
const K = 60;
const C = 6;
// dt 上限 1/30s：tab 切回时 d3 不传真实 dt，这里自钳防一帧位移爆冲
const MAX_DT = 1 / 30;

/**
 * 对单个节点施加一步弹簧：把 (vx,vy) 朝 anchor 拉，写回 node.vx/vy。
 * d3 sim 已把上一帧 vx/vy 应用到 x/y，这里只融合速度增量，位置交还 d3 推进。
 * dtSec 传秒（外部用上一帧到当前帧的耗时；省事可传 1/60）。
 */
export function applySpringStep(
  node: { x?: number; y?: number; vx?: number; vy?: number },
  ax: number,
  ay: number,
  dtSec: number,
): void {
  if (node.x == null || node.y == null) return;
  const dt = Math.min(dtSec, MAX_DT);
  const dx = ax - node.x;
  const dy = ay - node.y;
  let vx = node.vx ?? 0;
  let vy = node.vy ?? 0;
  // 半隐式：a = (k·位移 - c·速度)/m，先推速度
  vx += (K * dx - C * vx) * dt;
  vy += (K * dy - C * vy) * dt;
  node.vx = vx;
  node.vy = vy;
}

/** springBack 受扰能量低于此值即交还 d3 cluster 力 */
export const PERTURB_MIN = 0.02;

interface SpringNode {
  x?: number; y?: number; vx?: number; vy?: number;
  fx?: number | null; fy?: number | null;
  _ax?: number; _ay?: number; _perturb?: number;
}

/**
 * 对全体节点跑一步 springBack 回归：受扰能量 > PERTURB_MIN 的球用弹簧拉回 anchor，
 * 能量按 0.985/帧 衰减直至退出（交还 d3）。fx/fy 锁定（拖拽）的球清零跳过。
 * 返回新的 lastTick（毫秒）。
 */
export function springReturnStep(
  nodes: SpringNode[],
  cx: number,
  cy: number,
  lastTick: number,
): number {
  const now = performance.now();
  const dt = lastTick ? (now - lastTick) / 1000 : 1 / 60;
  for (const pn of nodes) {
    const e = pn._perturb ?? 0;
    if (e <= PERTURB_MIN) continue;
    if (pn.fx != null || pn.fy != null) { pn._perturb = 0; continue; }
    applySpringStep(pn, pn._ax ?? cx, pn._ay ?? cy, dt);
    pn._perturb = e * 0.985;
  }
  return now;
}
