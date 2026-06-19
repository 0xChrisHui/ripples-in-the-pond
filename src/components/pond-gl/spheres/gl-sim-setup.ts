'use client';

import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceLink,
  forceX,
  forceY,
  type Simulation,
  type ForceCenter,
} from 'd3-force';
import {
  CFG,
  hashStr,
  halton,
  fLayer,
  NUM_LAYERS,
  buildClusterAssignment,
  computeNodeAttrs,
  generateLinks,
  type GroupId,
  type SimNode,
  type SimLink,
} from '@/src/components/archipelago/sphere-config';
import type { Track } from '@/src/types/tracks';

/**
 * G4 — GL 球的 d3-force sim builder（无 SVG 耦合版）。
 *
 * 力参数 1:1 **快照**自 `src/components/archipelago/sphere-sim-setup.ts`
 * （红线：该文件只读，故把参数复制到此并注明出处行号）。
 * G4 只复刻"默认态"基础漂浮，不接 Lane C 物理（springBack/viscous/breeze 默认就是 false）。
 * 与 SVG 版唯一差异：tick 只做边界 clamp，不写任何 DOM —— GL 用 R3F useFrame 直接读 node.x/y。
 */

const ALPHA_BASELINE = 0.008; // 出处 sphere-sim-setup.ts:25（持续漂浮 baseline alpha）
const PAD = 20;               // 出处 sphere-sim-setup.ts:26（边界内缩）

// 深度轴 100 层（0=塘底 / 100=顶）。球随机分布在 30–80 层 → 归一深度 z∈[0.30,0.80]。
// 水面滚动 10–100 层（见 water-level.ts effective），两端各留 20 层余量 → 层10 全出水、层100 全没入。
const BALL_LAYER_LO = 0.30; // 球最低层 30/100
const BALL_LAYER_HI = 0.80; // 球最高层 80/100

// z = 基准深度（建点固定，painter 排序用）；displayZ = H5 每帧浮沉后的动态深度（消费方读它）。
// _dragLoose 对标 sphere-sim-setup.ts；_focusLerp = H5 播放球浮出焦点的缓动状态（见 sphere-motion）。
export type GlPhysNode = SimNode & {
  z: number;
  _dragLoose?: boolean;
  displayZ?: number;
  _focusLerp?: number;
  _gvx?: number; // 涟漪推"滑行"速度（独立于 d3 velocityDecay，慢衰减 → 惯性收尾，见 gl-sim-waves stepSphereGlide）
  _gvy?: number;
  _waveZ?: number; // 「球浮动」层级波动值 ∈[-amp,amp]（sphere-motion 写）；/test1 当尺寸倍率 (1+_waveZ) 消费 → 球变大/小
};

/** tracksToShow → 节点 + 链接（复刻 SphereCanvas.tsx:64-83 的建点逻辑，含 baseLayer/lw/radius/z） */
export function buildGlNodes(tracksToShow: Track[], groupId: GroupId): {
  nodes: GlPhysNode[];
  links: SimLink[];
  assignment: Map<string, number>;
} {
  const baseNodes = tracksToShow.map((t) => ({
    id: t.id,
    track: t,
    ...computeNodeAttrs(t, groupId),
  }));
  const { assignment } = buildClusterAssignment(baseNodes.map((n) => n.id));
  // 深度 z：每球随机分布在 30–80 层（归一 [0.30,0.80]），hash 决定 → 稳定可复现；z 用于没入判定 + painter 排序。
  // 大小 baseLayer：把带内位置归一到满层级（深=小/近面=大），保留与原来一样的完整大小变化，不因深度收窄而变同质。
  const nodes: GlPhysNode[] = baseNodes.map((n) => {
    const h = hashStr(n.id);
    const z = BALL_LAYER_LO + ((h % 1000) / 1000) * (BALL_LAYER_HI - BALL_LAYER_LO);
    const sizeT = (z - BALL_LAYER_LO) / (BALL_LAYER_HI - BALL_LAYER_LO); // 0=最深(最小) … 1=近面(最大)
    const baseLayer = Math.max(1, Math.min(NUM_LAYERS, Math.round((1 - sizeT) * (NUM_LAYERS - 1) + 1)));
    const lw = {
      amp: 0.6 + Math.random() * 0.8,
      f1: 0.04 + Math.random() * 0.08,
      f2: 0.10 + Math.random() * 0.15,
      p1: Math.random() * 6.283,
      p2: Math.random() * 6.283,
    };
    return { ...n, baseLayer, lw, radius: n.kSize * fLayer(baseLayer), z };
  });
  // 远先画：z 升序（与 use-sphere-z sortedNodes 同序）→ instance index = 绘制顺序
  nodes.sort((a, b) => a.z - b.z);
  const links = generateLinks(nodes, assignment);
  return { nodes, links, assignment };
}

/** cluster 锚点（绝对 px）；resize 时随尺寸等比缩放，故单列类型供 resizeGlSim 用 */
type ClusterAnchor = { x: number; y: number; strength: number };

/** 建 sim（力参数快照自 sphere-sim-setup.ts:34-133，去掉 onTick 的 SVG 写入）。
 *  返回 anchors（cluster 锚点 Map）供 J2 resizeGlSim 等比缩放——否则 cluster 力把球拉回旧 px。 */
export function setupGlSimulation(
  nodes: GlPhysNode[],
  links: SimLink[],
  assignment: Map<string, number>,
  width: number,
  height: number,
): { sim: Simulation<SimNode, SimLink>; anchors: Map<string, ClusterAnchor> } {
  const cx = width / 2;
  const cy = height / 2;

  // cluster anchor（含 size<=2 的 30% 外圈逻辑）— 出处 sphere-sim-setup.ts:50-62
  const clusterCount = Math.max(...Array.from(assignment.values()), 0) + 1;
  const clusterSizes = Array.from({ length: clusterCount }, () => 0);
  assignment.forEach((cid) => { if (cid >= 0 && cid < clusterCount) clusterSizes[cid]++; });
  const clusterAnchors = Array.from({ length: Math.max(clusterCount, 1) }, (_, i) => {
    const isOuter = (clusterSizes[i] ?? 0) <= 2 && Math.random() < 0.30;
    const range = isOuter ? 0.60 : 0.36;
    const offset = isOuter ? 0.20 : 0.32;
    return { x: width * (offset + halton(i + 1, 2) * range), y: height * (offset + halton(i + 1, 3) * range) };
  });

  // anchorMap + 初始落点（jitter ±15，strength 0.18）— 出处 sphere-sim-setup.ts:64-82
  const anchorMap = new Map<string, ClusterAnchor>();
  nodes.forEach((n) => {
    const c = assignment.get(n.id) ?? 0;
    const a = clusterAnchors[c] ?? { x: cx, y: cy };
    const h = hashStr(n.id);
    const ax = a.x + (((h >>> 5) % 30) - 15);
    const ay = a.y + (((h >>> 13) % 30) - 15);
    anchorMap.set(n.id, { x: ax, y: ay, strength: 0.18 });
    n.x = ax; n.y = ay; n.vx = 0; n.vy = 0;
    delete n.fx; delete n.fy;
  });

  // 拖过的球让出大部分 cluster 拉力（其余 0.18）— 出处 sphere-sim-setup.ts:85-90
  const strengthOf = (d: SimNode) =>
    (d as GlPhysNode)._dragLoose ? 0.025 : (anchorMap.get(d.id)?.strength ?? 0.1);

  // charge/link/collide/cluster/center 全部 viscous=off 档（默认态）— 出处 sphere-sim-setup.ts:94-114
  const sim = forceSimulation<SimNode>(nodes)
    .force('link', forceLink<SimNode, SimLink>(links)
      .id((d) => d.id)
      .distance((d) => CFG.linkBaseDist + (1 - d.correlation) * CFG.linkVariance)
      .strength((d) => d.correlation * 0.30))
    .force('charge', forceManyBody<SimNode>().strength((d) => -(70 * (0.6 + d.importance * 0.8))))
    .force('collide', forceCollide<SimNode>().radius((d) => d.radius * 1.1 + 8).strength(0.85).iterations(4))
    .force('cluster-x', forceX<SimNode>((d) => anchorMap.get(d.id)?.x ?? cx).strength(strengthOf))
    .force('cluster-y', forceY<SimNode>((d) => anchorMap.get(d.id)?.y ?? cy).strength(strengthOf))
    .force('center', forceCenter(cx, cy).strength(0.03))
    .alphaDecay(0.016)
    .velocityDecay(0.5)
    .alphaTarget(ALPHA_BASELINE)
    .alpha(0.3);

  // tick：仅边界 clamp（不写 DOM）— 出处 sphere-sim-setup.ts:124-128
  sim.on('tick', () => {
    nodes.forEach((n) => {
      if (n.fx != null || n.fy != null) return;
      if (n.x != null) n.x = Math.max(PAD, Math.min(width - PAD, n.x));
      if (n.y != null) n.y = Math.max(PAD, Math.min(height - PAD, n.y));
    });
  });

  return { sim, anchors: anchorMap };
}

/**
 * J2 — 窗口/转屏后把 sim 适配到新尺寸：等比缩放节点位置 + cluster 锚点（否则 cluster 力把球拉回旧 px），
 * 更新中心力 + 边界 clamp 到新宽高。配合 SphereInstances 相机跟随 sizeRef → GL 球与 DOM 命中层保持对齐。
 */
export function resizeGlSim(
  sim: Simulation<SimNode, SimLink>,
  nodes: GlPhysNode[],
  anchors: Map<string, ClusterAnchor>,
  sx: number,
  sy: number,
  width: number,
  height: number,
): void {
  for (const n of nodes) {
    if (n.x != null) n.x *= sx;
    if (n.y != null) n.y *= sy;
    if (n.fx != null) n.fx *= sx;
    if (n.fy != null) n.fy *= sy;
  }
  anchors.forEach((a) => { a.x *= sx; a.y *= sy; });
  const center = sim.force('center') as ForceCenter<SimNode> | undefined;
  if (center) center.x(width / 2).y(height / 2);
  // 边界 clamp 重注册到新宽高（旧 tick 闭包捕获的是旧 width/height）
  sim.on('tick', () => {
    nodes.forEach((n) => {
      if (n.fx != null || n.fy != null) return;
      if (n.x != null) n.x = Math.max(PAD, Math.min(width - PAD, n.x));
      if (n.y != null) n.y = Math.max(PAD, Math.min(height - PAD, n.y));
    });
  });
  sim.alpha(0.12).restart();
}

/**
 * 拖拽写 fx/fy / 释放（模块级函数：命令式 mutate sim 节点，避开 react-hooks/immutability
 * 对组件内改 prop 的限制——sim 节点本就是 d3 拥有的可变状态，与 SVG attachDrag 同语义）。
 */
export function setNodeDrag(node: GlPhysNode, x: number, y: number): void {
  node.fx = x;
  node.fy = y;
}
export function endNodeDrag(node: GlPhysNode): void {
  node.fx = null;
  node.fy = null;
  node._dragLoose = true; // 拖过的球弱回弹（出处 sphere-sim-setup.ts:209）
}

// 背景涟漪推球（BgWave / pushGlSpheresByWaves）已拆到 ./gl-sim-waves（J2 加 resizeGlSim 后撞 220 行硬线）。
