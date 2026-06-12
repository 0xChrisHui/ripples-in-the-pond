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
  hashStr,
  halton,
  type SimNode,
  type SimLink,
} from './sphere-config';
import { getPhys } from './forces/phys-config';
import { springReturnStep, PERTURB_MIN } from './forces/spring';
import { setBreezeTargets } from './forces/breeze-force';

/** sim 持续漂浮的 baseline alpha */
const ALPHA_BASELINE = 0.008;
const PAD = 20;

// Lane C — 节点物理私有字段（同 _dragLoose 模式）：_ax/_ay=spring 回归 anchor，_perturb=受扰能量 0-1
type PhysNode = SimNode & {
  _dragLoose?: boolean;
  _ax?: number; _ay?: number; _perturb?: number;
};

export function setupSimulation(
  simNodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
  assignment: Map<string, number>,
  clusterCount: number,
  onTick: () => void,
): Simulation<SimNode, SimLink> {
  const cx = width / 2;
  const cy = height / 2;

  // v32 — clusterCount 动态（buildClusterAssignment 决定，每次 sim 重建即变）。
  // 每个 cluster 一个 halton anchor，cluster 内节点共享 anchor + jitter。
  // v33 — size<=2 的小 cluster 有 30% 概率落在外圈 0.20-0.80（60% 屏宽），
  //       让 ~2 个小聚落漂远但不到边缘；其他 cluster 仍在中心 0.32-0.68（36%）。
  const clusterSizes = Array.from({ length: clusterCount }, () => 0);
  assignment.forEach((cid) => {
    if (cid >= 0 && cid < clusterCount) clusterSizes[cid]++;
  });
  const clusterAnchors = Array.from({ length: Math.max(clusterCount, 1) }, (_, i) => {
    const isOuter = (clusterSizes[i] ?? 0) <= 2 && Math.random() < 0.30;
    const range = isOuter ? 0.60 : 0.36;
    const offset = isOuter ? 0.20 : 0.32;
    return {
      x: width * (offset + halton(i + 1, 2) * range),
      y: height * (offset + halton(i + 1, 3) * range),
    };
  });

  const anchorMap = new Map<string, { x: number; y: number; strength: number }>();
  simNodes.forEach((n) => {
    const c = assignment.get(n.id) ?? 0;
    const a = clusterAnchors[c] ?? { x: cx, y: cy };
    const h = hashStr(n.id);
    const jx = ((h >>> 5) % 30) - 15;
    const jy = ((h >>> 13) % 30) - 15;
    const ax = a.x + jx;
    const ay = a.y + jy;
    anchorMap.set(n.id, { x: ax, y: ay, strength: 0.18 });
    n.x = ax;
    n.y = ay;
    n.vx = 0;
    n.vy = 0;
    delete n.fx;
    delete n.fy;
    const pn = n as PhysNode; // Lane C — anchor 同步到私有字段供 springBack tick 读取
    pn._ax = ax; pn._ay = ay; pn._perturb = 0;
  });
  setBreezeTargets(simNodes as PhysNode[]); // Lane C breeze — 把当前节点交给微风施力模块

  const strengthOf = (d: SimNode) => { // Lane C springBack — 受扰球 cluster 拉力让给弹簧（返回 0）
    const pn = d as PhysNode;
    if (getPhys().springBack && (pn._perturb ?? 0) > PERTURB_MIN) return 0;
    if (pn._dragLoose) return 0.025;
    return anchorMap.get(d.id)?.strength ?? 0.1;
  };

  // Lane C viscous — 关=原样；开=削弱 charge/link 去星系结构感（×0.35/×0.4）+ 调高 velocityDecay 黏滞
  const visc = () => getPhys().viscous;
  const chargeForce = forceManyBody<SimNode>().strength((d) =>
    -(70 * (0.6 + d.importance * 0.8)) * (visc() ? 0.35 : 1),
  );
  const linkForce = forceLink<SimNode, SimLink>(links)
    .id((d) => d.id)
    .distance((d) => CFG.linkBaseDist + (1 - d.correlation) * CFG.linkVariance)
    .strength((d) => d.correlation * (visc() ? 0.12 : 0.30));

  const sim = forceSimulation<SimNode>(simNodes)
    .force('link', linkForce)
    .force('charge', chargeForce)
    .force('collide', forceCollide<SimNode>()
      // v32 — r*1.0+4（v31 太挤）→ r*1.1+8，介于 v30/v31 之间
      .radius((d) => d.radius * 1.1 + 8).strength(0.85).iterations(4))
    .force('cluster-x', forceX<SimNode>((d) => anchorMap.get(d.id)?.x ?? cx).strength(strengthOf))
    .force('cluster-y', forceY<SimNode>((d) => anchorMap.get(d.id)?.y ?? cy).strength(strengthOf))
    .force('center', forceCenter(cx, cy).strength(0.03))
    .alphaDecay(0.016)
    .velocityDecay(0.5)
    .alphaTarget(ALPHA_BASELINE)
    .alpha(0.3);

  let lastTick = 0; // springBack 自适应 dt（毫秒时间戳）
  sim.on('tick', () => {
    const phys = getPhys();
    // viscous — 实时切 velocityDecay 黏滞档（开 0.72 拖泥带水 / 关 0.5 原值）
    sim.velocityDecay(phys.viscous ? 0.72 : 0.5);
    // springBack — 受扰球弹簧回归 anchor（过冲回摆），力逻辑在 forces/spring.ts
    lastTick = phys.springBack ? springReturnStep(simNodes as PhysNode[], cx, cy, lastTick) : 0;

    simNodes.forEach((n) => {
      if (n.fx != null || n.fy != null) return;
      if (n.x != null) n.x = Math.max(PAD, Math.min(width - PAD, n.x));
      if (n.y != null) n.y = Math.max(PAD, Math.min(height - PAD, n.y));
    });
    onTick();
  });

  return sim;
}

/** 背景涟漪在球周围扩散时的瞬时数据（spawn 时由 BackgroundRipples 通过事件传入）*/
export interface BgWave {
  x: number;
  y: number;
  size: number;
  spawnTime: number;
  duration: number;
}

/** 涟漪经过球时给球加微小 outward velocity；playing/拖过/fx 锁定的球跳过 */
export function pushSpheresByWaves(
  simNodes: SimNode[],
  waves: BgWave[],
  playingId: string | null,
  now: number,
): void {
  if (waves.length === 0) return;
  for (const n of simNodes) {
    if (n.id === playingId) continue;
    if (n.fx != null || n.fy != null) continue;
    if ((n as SimNode & { _dragLoose?: boolean })._dragLoose) continue;
    if (n.x == null || n.y == null) continue;
    for (const w of waves) {
      const ratio = (now - w.spawnTime) / w.duration;
      if (ratio < 0.05 || ratio > 0.85) continue;
      const curR = w.size * (0.15 + ratio * 1.25);
      const dx = n.x - w.x;
      const dy = n.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      const band = 70;
      const dist = Math.abs(d - curR);
      if (dist < band) {
        const force = 0.18 * (1 - dist / band);
        n.vx = (n.vx ?? 0) + (dx / d) * force;
        n.vy = (n.vy ?? 0) + (dy / d) * force;
        // Lane C springBack — 标记受扰，回归阶段交弹簧驱动（过冲回摆）
        (n as PhysNode)._perturb = 1;
      }
    }
  }
}

/** drag 阈值：位移 < 8px 不算拖动，松手 React onClick 仍触发 toggle */
const DRAG_THRESHOLD = 8;
export function attachDrag(
  elMap: Map<string, SVGGElement>,
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

  // v36 — elMap 取代 array：支持 render 按 z 排序后仍按 id 精确接 drag
  nodes.forEach((node) => {
    const el = elMap.get(node.id);
    if (el) {
      select<SVGGElement, SimNode>(el).datum(node).call(dragBehavior);
    }
  });
}
