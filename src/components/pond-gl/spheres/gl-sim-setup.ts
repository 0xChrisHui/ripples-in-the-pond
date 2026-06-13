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

// 拖过的球减弱 cluster 拉力（几乎留在新位置），对标 sphere-sim-setup.ts 的 _dragLoose
export type GlPhysNode = SimNode & { z: number; _dragLoose?: boolean };

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
  const { assignment, clusterCount } = buildClusterAssignment(baseNodes.map((n) => n.id));
  // baseLayer 由 z 派生（与 use-sphere-z.ts 同公式），z 用于 painter 排序
  const clusterZ = Array.from({ length: clusterCount }, (_, i) => halton(i + 1, 5));
  const nodes: GlPhysNode[] = baseNodes.map((n) => {
    const baseZ = clusterZ[assignment.get(n.id) ?? 0] ?? 0.5;
    const h = hashStr(n.id);
    const z = Math.max(0, Math.min(1, baseZ + ((h % 601) / 1000) - 0.3));
    const baseLayer = Math.max(1, Math.min(NUM_LAYERS, Math.round((1 - z) * (NUM_LAYERS - 1) + 1)));
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

/** 建 sim（力参数快照自 sphere-sim-setup.ts:34-133，去掉 onTick 的 SVG 写入） */
export function setupGlSimulation(
  nodes: GlPhysNode[],
  links: SimLink[],
  assignment: Map<string, number>,
  width: number,
  height: number,
): Simulation<SimNode, SimLink> {
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
  const anchorMap = new Map<string, { x: number; y: number; strength: number }>();
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

  return sim;
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

/** 背景涟漪经过球时给球加 outward velocity（快照自 sphere-sim-setup.ts:145-175，去掉 _perturb） */
export interface BgWave { x: number; y: number; size: number; spawnTime: number; duration: number }

export function pushGlSpheresByWaves(
  nodes: GlPhysNode[],
  waves: BgWave[],
  playingId: string | null,
  now: number,
): void {
  if (waves.length === 0) return;
  for (const n of nodes) {
    if (n.id === playingId || n.fx != null || n.fy != null || n.x == null || n.y == null) continue;
    for (const w of waves) {
      const ratio = (now - w.spawnTime) / w.duration;
      if (ratio < 0.05 || ratio > 0.85) continue;
      const curR = w.size * (0.15 + ratio * 1.25);
      const dx = n.x - w.x;
      const dy = n.y - w.y;
      const dd = Math.hypot(dx, dy) || 1;
      const band = 70;
      const dist = Math.abs(dd - curR);
      if (dist < band) {
        const force = 0.18 * (1 - dist / band);
        n.vx = (n.vx ?? 0) + (dx / dd) * force;
        n.vy = (n.vy ?? 0) + (dy / dd) * force;
      }
    }
  }
}
