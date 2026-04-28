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
import { CFG, CLUSTER_COUNT, type SimNode, type SimLink } from './sphere-config';

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

  // Phase 6 B2.1 v6 — 5 个 cluster anchor 让节点形成聚落（非均匀分布）
  // v8 修：anchor 间距加大（22% → 30% / 18% → 25%）让 5 cluster 不互相挤
  const clusterAnchors: { x: number; y: number }[] = [
    { x: cx - width * 0.30, y: cy - height * 0.25 },
    { x: cx + width * 0.32, y: cy - height * 0.28 },
    { x: cx - width * 0.26, y: cy + height * 0.28 },
    { x: cx + width * 0.28, y: cy + height * 0.22 },
    { x: cx,                y: cy },
  ];

  // v11 — 给每个节点分配独立 anchor + strength：
  // 30% 概率作为 outlier（屏幕随机散点 + 弱拉力），70% 在 cluster 内（强拉 + 微 jitter）。
  // 实现"散点 + 聚落"格局，分布更随机。
  const anchorMap = new Map<string, { x: number; y: number; strength: number }>();
  simNodes.forEach((n) => {
    const isOutlier = Math.random() < 0.3;
    let ax: number;
    let ay: number;
    let strength: number;
    if (isOutlier) {
      ax = PAD + Math.random() * (width - PAD * 2);
      ay = PAD + Math.random() * (height - PAD * 2);
      strength = 0.025; // 极弱拉力，自由漂
    } else {
      const a = clusterAnchors[n.cluster % CLUSTER_COUNT];
      ax = a.x + (Math.random() - 0.5) * 90;
      ay = a.y + (Math.random() - 0.5) * 90;
      strength = 0.14;
    }
    anchorMap.set(n.id, { x: ax, y: ay, strength });

    n.x = ax + (Math.random() - 0.5) * 30;
    n.y = ay + (Math.random() - 0.5) * 30;
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
    // v11 — forceX/Y 用每节点独立 anchor + strength（cluster 内强拉，outlier 弱拉）
    .force(
      'cluster-x',
      forceX<SimNode>((d) => anchorMap.get(d.id)?.x ?? cx).strength(
        (d) => anchorMap.get(d.id)?.strength ?? 0.1,
      ),
    )
    .force(
      'cluster-y',
      forceY<SimNode>((d) => anchorMap.get(d.id)?.y ?? cy).strength(
        (d) => anchorMap.get(d.id)?.strength ?? 0.1,
      ),
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
 * Drag 行为照抄 sound-spheres line 661-679：
 * - drag start 不重启 sim（避免单击触发抖动）
 * - 实际 mousemove 才标 _dragged + alphaTarget(0.08).restart()
 * - drag end alphaTarget(0) 让 sim 衰减回稳定（"永远可拖" 通过下次 drag 重启实现）
 */
export function attachDrag(
  els: (SVGGElement | null)[],
  nodes: SimNode[],
  sim: Simulation<SimNode, SimLink>,
): void {
  const dragBehavior = drag<SVGGElement, SimNode>()
    .on('start', (e, d) => {
      d._dragged = false;
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (e, d) => {
      if (!d._dragged) {
        d._dragged = true;
        if (!e.active) sim.alphaTarget(0.08).restart();
      }
      d.fx = e.x;
      d.fy = e.y;
    })
    .on('end', (e, d) => {
      // v11：保留 fx/fy 不释放 — 节点固定在拖到位置，可脱离聚落不回弹
      // 其他未拖节点仍受 alphaTarget baseline 微漂浮
      if (!e.active) sim.alphaTarget(ALPHA_BASELINE);
      void d;
    });

  els.forEach((el, i) => {
    if (el) {
      select<SVGGElement, SimNode>(el).datum(nodes[i]).call(dragBehavior);
    }
  });
}
