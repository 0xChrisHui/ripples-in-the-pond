import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Track } from '@/src/types/tracks';

/** sound-spheres 配置 + 节点/链接生成纯函数 */

// v26 — 3 group palette 皆 8 色：A Portra 暖橙基底；B Cinestill 800T 夜景；C Ektar 100 鲜艳
export const GROUP_PALETTES: string[][] = [
  ['#D8A878','#7EA898','#A83A3A','#6A7898','#E8D8B8','#382828','#B8A8C8','#9AA878'],
  ['#D8A878','#7EA898','#E8D8B8','#382828','#B8A8C8','#9AA878','#C8504A','#888858'],
  ['#D8A878','#7EA898','#A83A3A','#6A7898','#E8D8B8','#9AA878','#D88A4A','#5A8868'],
];

export type GroupId = 'A' | 'B' | 'C';

export interface GroupDef {
  id: GroupId;
  label: string;
  color: string;
}

export const GROUPS: GroupDef[] = [
  { id: 'A', label: '1', color: GROUP_PALETTES[0][0] },
  { id: 'B', label: '2', color: GROUP_PALETTES[1][0] },
  { id: 'C', label: '3', color: GROUP_PALETTES[2][0] },
];

// v31 — 球大小 9/30，靠减 collide 斥力 + 提 outlier 拉力压总占地
export const CFG = {
  minR: 9,
  maxR: 30,
  charge: 280,
  linkBaseDist: 50,
  linkVariance: 50,
  slideMs: 420,
};

export interface SimNode extends SimulationNodeDatum {
  id: string;
  track: Track;
  groupId: GroupId;
  importance: number;
  radius: number;
  color: string;
  baseLayer: number;
  kSize: number;
  lw: { amp: number; f1: number; f2: number; p1: number; p2: number };
  _dragged?: boolean;
}

// v75/v86 — N=10 层，K∈[24,28]（v86 K_MIN 16→24，球级最小变大 1.5×），f(1)=1.0、f(10)=0.5
export const NUM_LAYERS = 10, LAYER_MIN_FACTOR = 0.5, K_MIN = 24, K_MAX = 28;

export function fLayer(x: number): number {
  return 1 - ((x - 1) / (NUM_LAYERS - 1)) * (1 - LAYER_MIN_FACTOR);
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) & 0xffffffff) >>> 0;
  return h;
}

/**
 * v32 — 随机 cluster 划分：大小池 power-law（单球/对儿/三球/大聚落混合）。
 * 必须在 useEffect 内调用（用了 Math.random，避 react-hooks/purity）。
 * size=1 的 cluster 自然就是孤立球。
 */
export function buildClusterAssignment(nodeIds: string[]): {
  assignment: Map<string, number>;
  clusterCount: number;
} {
  const shuffled = [...nodeIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const assignment = new Map<string, number>();
  const sizePool = [1, 2, 2, 3, 3, 4, 4, 5];
  let i = 0;
  let cid = 0;
  while (i < shuffled.length) {
    const remain = shuffled.length - i;
    const size = Math.min(remain, sizePool[Math.floor(Math.random() * sizePool.length)]);
    for (let j = 0; j < size; j++) {
      assignment.set(shuffled[i + j], cid);
    }
    i += size;
    cid++;
  }
  return { assignment, clusterCount: cid };
}

/** Halton 低差异序列（生成均匀分布的 anchor 位置）*/
export function halton(i: number, base: number): number {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  correlation: number;
}

// Phase 6 B6（2026-05-04）：A 组只显 published=true 的 5 球（艺术家 demo）；
// B/C 组保持原 36 球行为（音频 SQL 层循环到 No.1-5）
export function getGroupTracks(gid: GroupId, allTracks: Track[]): Track[] {
  if (gid === 'A') return allTracks.filter((t) => t.published);
  return allTracks.filter((t) => t.week >= 1 && t.week <= 36);
}

// A 组 15 球（P7 A6.1 扩容；artist 给 10 首新曲 No.6-15）/ B/C 组 36 球
export function getGroupTargetCount(gid: GroupId): number {
  return gid === 'A' ? 15 : 36;
}

// DB < target 时循环 padding；改 week 1..target 让颜色/size 各异；id 加后缀避 React key 冲突
export function padTracksToTarget(real: Track[], target: number): Track[] {
  if (real.length === 0) return [];
  if (real.length >= target) return real.slice(0, target);
  const padded: Track[] = [];
  for (let i = 0; i < target; i++) {
    const src = real[i % real.length];
    padded.push({
      ...src,
      id: i < real.length ? src.id : `${src.id}-fill-${i}`,
      week: i + 1,
    });
  }
  return padded;
}

// week 派生 importance + 颜色，全 deterministic
export function computeNodeAttrs(track: Track, groupId: GroupId): {
  groupId: GroupId;
  importance: number;
  radius: number;
  color: string;
  kSize: number;
} {
  const importance = 0.30 + ((track.week * 13) % 65) / 100;
  const kHash = ((track.week * 17) % 100) / 100;
  const kSize = K_MIN + kHash * (K_MAX - K_MIN);
  const groupIdx = GROUPS.findIndex((g) => g.id === groupId);
  const palette = GROUP_PALETTES[groupIdx];
  const shadeIdx = (track.week - 1) % palette.length;
  return { groupId, importance, radius: kSize, color: palette[shadeIdx], kSize };
}

/**
 * v32 — 聚落式 link：仅同 cluster 全连接（拉力方向 ≡ cluster anchor，不撕裂）。
 * v86 — 加跨 cluster 稀疏边：每对 cluster 5% 概率 1 条，corr 0.12-0.22 弱拉力
 *       拉力 ≈ 0.04-0.07，远弱于内部 0.15-0.24；距离 ≈ 89-94 自然拉长。
 */
export function generateLinks(
  nodes: SimNode[],
  assignment: Map<string, number>,
): SimLink[] {
  const links: SimLink[] = [];
  const clusterMembers = new Map<number, number[]>();
  nodes.forEach((n, i) => {
    const c = assignment.get(n.id);
    if (c == null) return;
    if (!clusterMembers.has(c)) clusterMembers.set(c, []);
    clusterMembers.get(c)!.push(i);
  });

  clusterMembers.forEach((indices) => {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const seed = (indices[a] * 17 + indices[b] * 31) % 100;
        const corr = 0.5 + (seed % 30) / 100;
        links.push({
          source: nodes[indices[a]].id,
          target: nodes[indices[b]].id,
          correlation: Math.min(0.85, corr),
        });
      }
    }
  });

  const clusterIds = Array.from(clusterMembers.keys());
  for (let a = 0; a < clusterIds.length; a++) {
    for (let b = a + 1; b < clusterIds.length; b++) {
      if (Math.random() > 0.05) continue;
      const m1 = clusterMembers.get(clusterIds[a])!;
      const m2 = clusterMembers.get(clusterIds[b])!;
      const i1 = m1[Math.floor(Math.random() * m1.length)];
      const i2 = m2[Math.floor(Math.random() * m2.length)];
      links.push({
        source: nodes[i1].id,
        target: nodes[i2].id,
        correlation: 0.12 + Math.random() * 0.10,
      });
    }
  }

  return links;
}
