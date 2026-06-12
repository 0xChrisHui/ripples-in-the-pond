/**
 * Lane C 物理线 — 微风施力（F4 breeze 的物理部分）
 *
 * breeze.tsx 每阵风 dispatch 'pond:breeze-gust' {dirX,dirY,mag}（已归一化方向 + 量级），
 * 本模块对当前 sim 全体球施加同向微力（量级远小于涟漪 0.18），并标记 _perturb 让
 * springBack 开时风停回摆。施力分散在风时长内逐帧加（由 breeze.tsx 按 2-3s 多次 dispatch）。
 *
 * 模块级单例：sim 重建时 setBreezeTargets 换数组；窗口监听只装一次，随页面生命周期。
 */

interface GustNode {
  vx?: number; vy?: number;
  fx?: number | null; fy?: number | null;
  _dragLoose?: boolean; _perturb?: number;
}

let targets: GustNode[] = [];

/** sphere-sim-setup 在每次 setup 时把当前节点数组交给本模块 */
export function setBreezeTargets(nodes: GustNode[]): void {
  targets = nodes;
}

function onGust(e: Event): void {
  const d = (e as CustomEvent<{ dirX: number; dirY: number; mag: number }>).detail;
  if (!d) return;
  for (const n of targets) {
    if (n.fx != null || n.fy != null) continue; // 拖拽锁定不吹
    if (n._dragLoose) continue;
    n.vx = (n.vx ?? 0) + d.dirX * d.mag;
    n.vy = (n.vy ?? 0) + d.dirY * d.mag;
    n._perturb = 1; // 风停后由 springBack 弹簧回稳（关时 d3 cluster 力照常回拉）
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pond:breeze-gust', onGust);
}
