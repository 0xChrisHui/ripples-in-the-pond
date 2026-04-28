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
import { CFG, type SimNode, type SimLink } from './sphere-config';

/** sim 持续漂浮的 baseline alpha（v8 减到 0.008，更微弱漂浮）*/
const ALPHA_BASELINE = 0.008;

/**
 * Phase 6 B2.1 — D3 force simulation + drag 的纯函数 setup
 * 从 SphereCanvas 抽出（220 行硬线）— 不是 hook，仅函数提取，行为完全不变
 *
 * v3 修复（2026-04-27）：
 * - 加 forceX + forceY 0.06 strength（柔和朝中心拉，不依赖 forceCenter 单点）
 * - center.strength 0.05 → 0.1（更强收敛）
 * - tick 内 clamp x/y 到画布边界（最后保险，不会飞出屏幕）
 * - setupSimulation 接 links 参数（外部 generate，方便和渲染层共享）
 */

const PAD = 20; // v10：60 → 20，给拖动留更宽边界

export function setupSimulation(
  simNodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
  onTick: () => void,
): Simulation<SimNode, SimLink> {
  const cx = width / 2;
  const cy = height / 2;

  // v12 — 重写分布算法：power-law cluster 容量 + 完全随机 anchor + 35% outlier。
  // 实现真正的"散点 + 聚落"格局：
  //   - 4 个 cluster 容量 [10, 6, 4, 3]，越后面越小
  //   - 每个 cluster anchor 位置完全随机（屏幕中部 60% 区域）
  //   - 35% outlier 散点：屏幕随机位置 + 极弱拉力（几乎自由）
  //   - cluster 内 jitter ±60px，cluster 之间不对称
  const clusterCapacities = [10, 6, 4, 3];
  const clusterAnchors: { x: number; y: number }[] = clusterCapacities.map(() => ({
    x: width * (0.18 + Math.random() * 0.64),
    y: height * (0.18 + Math.random() * 0.64),
  }));

  const anchorMap = new Map<string, { x: number; y: number; strength: number }>();
  let cIdx = 0;
  let cFill = 0;
  simNodes.forEach((n) => {
    const isOutlier = Math.random() < 0.35;
    let ax: number;
    let ay: number;
    let strength: number;
    if (isOutlier) {
      ax = PAD + Math.random() * (width - PAD * 2);
      ay = PAD + Math.random() * (height - PAD * 2);
      strength = 0.018;
    } else {
      while (cIdx < clusterAnchors.length && cFill >= clusterCapacities[cIdx]) {
        cIdx++;
        cFill = 0;
      }
      if (cIdx >= clusterAnchors.length) {
        ax = PAD + Math.random() * (width - PAD * 2);
        ay = PAD + Math.random() * (height - PAD * 2);
        strength = 0.018;
      } else {
        const a = clusterAnchors[cIdx];
        ax = a.x + (Math.random() - 0.5) * 60;
        ay = a.y + (Math.random() - 0.5) * 60;
        strength = 0.16;
        cFill++;
      }
    }
    anchorMap.set(n.id, { x: ax, y: ay, strength });
    n.x = ax + (Math.random() - 0.5) * 20;
    n.y = ay + (Math.random() - 0.5) * 20;
    n.vx = 0;
    n.vy = 0;
    delete n.fx;
    delete n.fy;
  });

  return forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance((d) => CFG.linkBaseDist + (1 - d.correlation) * CFG.linkVariance)
        .strength((d) => d.correlation * 0.30),
    )
    .force(
      'charge',
      // v8 charge 110 → 70（减弱排斥让 cluster 拉得住）
      forceManyBody<SimNode>().strength(
        (d) => -(70 * (0.6 + d.importance * 0.8)),
      ),
    )
    .force(
      'collide',
      // v9 拉开间距 — radius * 0.95 → * 1.4 + 14（节点之间留白，呼吸感）
      forceCollide<SimNode>()
        .radius((d) => d.radius * 1.4 + 14)
        .strength(0.85)
        .iterations(4),
    )
    // v12 — forceX/Y 用每节点独立 anchor + strength；
    //       拖过节点（_dragLoose）拉力减弱到 0.025（保留弱回弹流动感）
    .force(
      'cluster-x',
      forceX<SimNode>((d) => anchorMap.get(d.id)?.x ?? cx).strength((d) => {
        const dn = d as SimNode & { _dragLoose?: boolean };
        if (dn._dragLoose) return 0.025;
        return anchorMap.get(d.id)?.strength ?? 0.1;
      }),
    )
    .force(
      'cluster-y',
      forceY<SimNode>((d) => anchorMap.get(d.id)?.y ?? cy).strength((d) => {
        const dn = d as SimNode & { _dragLoose?: boolean };
        if (dn._dragLoose) return 0.025;
        return anchorMap.get(d.id)?.strength ?? 0.1;
      }),
    )
    // 弱的全局 center 兜底（防整体偏移屏幕）
    .force('center', forceCenter(cx, cy).strength(0.02))
    .alphaDecay(0.016)
    .velocityDecay(0.5)
    .alphaTarget(ALPHA_BASELINE)
    // v8 起始 alpha 0.3（默认 1.0）— 开局柔和展开，避免 0.5s 内剧烈抖动
    .alpha(0.3)
    .on('tick', () => {
      // clamp x/y 到画布内（防极端 charge 把节点推飞）
      // v10：被拖动节点（fx/fy 已固定）跳过 clamp — 让用户能完全自由拖
      simNodes.forEach((n) => {
        if (n.fx != null || n.fy != null) return;
        if (n.x != null) n.x = Math.max(PAD, Math.min(width - PAD, n.x));
        if (n.y != null) n.y = Math.max(PAD, Math.min(height - PAD, n.y));
      });
      onTick();
    });
}

/**
 * Drag 行为：
 * - drag start 记录起点
 * - 实际位移 > DRAG_THRESHOLD (8px) 才标 _dragged + 重启 sim
 * - 位移 < threshold 不算 drag，松手后 React onClick 仍触发 toggle 播放
 */
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
