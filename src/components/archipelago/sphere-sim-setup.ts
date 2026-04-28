import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceLink,
  forceX,
  forceY,
  type Simulation,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import {
  CFG,
  CLUSTER_COUNT,
  hashStr,
  halton,
  getNodeCluster,
  type SimNode,
  type SimLink,
} from './sphere-config';

/** sim 持续漂浮的 baseline alpha */
const ALPHA_BASELINE = 0.008;
const PAD = 20;

export function setupSimulation(
  simNodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
  onTick: () => void,
): Simulation<SimNode, SimLink> {
  const cx = width / 2;
  const cy = height / 2;

  // v15 — deterministic cluster：与 generateLinks 共用 getNodeCluster。
  // link 仅在同 cluster 内生成 → link 拉力方向 = cluster 拉力方向（一致），聚落不被撕裂。
  // Anchor 位置用 Halton 序列（均匀分布的 7 个点），确保 cluster 之间彼此远离。
  const clusterAnchors = Array.from({ length: CLUSTER_COUNT }, (_, i) => ({
    x: width * (0.15 + halton(i + 1, 2) * 0.70),
    y: height * (0.15 + halton(i + 1, 3) * 0.70),
  }));

  const anchorMap = new Map<string, { x: number; y: number; strength: number }>();
  simNodes.forEach((n) => {
    const c = getNodeCluster(n);
    const h = hashStr(n.id);
    let ax: number;
    let ay: number;
    let strength: number;
    if (c < 0) {
      // outlier：屏幕上 deterministic 散点位置
      ax = PAD + ((h % 1000) / 1000) * (width - 2 * PAD);
      ay = PAD + (((h >>> 10) % 1000) / 1000) * (height - 2 * PAD);
      strength = 0.018;
    } else {
      const a = clusterAnchors[c];
      const jx = ((h >>> 5) % 80) - 40; // ±40 jitter
      const jy = ((h >>> 13) % 80) - 40;
      ax = a.x + jx;
      ay = a.y + jy;
      strength = 0.22;
    }
    anchorMap.set(n.id, { x: ax, y: ay, strength });
    n.x = ax;
    n.y = ay;
    n.vx = 0;
    n.vy = 0;
    delete n.fx;
    delete n.fy;
  });

  const strengthOf = (d: SimNode) => {
    if ((d as SimNode & { _dragLoose?: boolean })._dragLoose) return 0.025;
    return anchorMap.get(d.id)?.strength ?? 0.1;
  };

  return forceSimulation<SimNode>(simNodes)
    .force('link', forceLink<SimNode, SimLink>(links)
      .id((d) => d.id)
      .distance((d) => CFG.linkBaseDist + (1 - d.correlation) * CFG.linkVariance)
      .strength((d) => d.correlation * 0.30))
    .force('charge', forceManyBody<SimNode>().strength((d) => -(70 * (0.6 + d.importance * 0.8))))
    .force('collide', forceCollide<SimNode>()
      .radius((d) => d.radius * 1.4 + 14).strength(0.85).iterations(4))
    .force('cluster-x', forceX<SimNode>((d) => anchorMap.get(d.id)?.x ?? cx).strength(strengthOf))
    .force('cluster-y', forceY<SimNode>((d) => anchorMap.get(d.id)?.y ?? cy).strength(strengthOf))
    .force('center', forceCenter(cx, cy).strength(0.02))
    .alphaDecay(0.016)
    .velocityDecay(0.5)
    .alphaTarget(ALPHA_BASELINE)
    .alpha(0.3)
    .on('tick', () => {
      simNodes.forEach((n) => {
        if (n.fx != null || n.fy != null) return;
        if (n.x != null) n.x = Math.max(PAD, Math.min(width - PAD, n.x));
        if (n.y != null) n.y = Math.max(PAD, Math.min(height - PAD, n.y));
      });
      onTick();
    });
}

/** drag 阈值：位移 < 8px 不算拖动，松手 React onClick 仍触发 toggle */
const DRAG_THRESHOLD = 8;
export function attachDrag(
  els: (SVGGElement | null)[],
  nodes: SimNode[],
  sim: Simulation<SimNode, SimLink>,
): void {
  const dragBehavior = drag<SVGGElement, SimNode>()
    .on('start', (e, d) => {
      d._dragged = false;
      const dn = d as SimNode & { _dragStartX?: number; _dragStartY?: number };
      dn._dragStartX = e.x;
      dn._dragStartY = e.y;
    })
    .on('drag', (e, d) => {
      const dn = d as SimNode & { _dragStartX?: number; _dragStartY?: number };
      if (!d._dragged) {
        const dx = e.x - (dn._dragStartX ?? e.x);
        const dy = e.y - (dn._dragStartY ?? e.y);
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // 微位移不算拖动
        d._dragged = true;
        if (!e.active) sim.alphaTarget(0.08).restart();
      }
      d.fx = e.x;
      d.fy = e.y;
    })
    .on('end', (e, d) => {
      // v12：释放 fx/fy 让节点恢复流动 + 标 _dragLoose 减弱该节点的 cluster 拉力
      // 效果：拖过的节点回弹很弱（几乎留在新位置），但仍参与 alpha 漂浮
      if (!e.active) sim.alphaTarget(ALPHA_BASELINE);
      d.fx = null;
      d.fy = null;
      (d as SimNode & { _dragLoose?: boolean })._dragLoose = true;
    });

  els.forEach((el, i) => {
    if (el) {
      select<SVGGElement, SimNode>(el).datum(nodes[i]).call(dragBehavior);
    }
  });
}
