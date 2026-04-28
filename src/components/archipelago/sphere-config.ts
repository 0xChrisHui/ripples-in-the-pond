import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Track } from '@/src/types/tracks';

/**
 * Phase 6 B2.1 — sound-spheres 的配置 + 节点/链接生成纯函数
 * 抽出来方便调色 / 调参 / 改 link 密度（不动 React/D3 渲染逻辑）
 *
 * 用户决策（2026-04-27）：3 group A/B/C 各 36 首；不做跨 group 虚线圈
 */

// 3 group palette
// A: Portra 暖橙系 8 色（保留）
// B: 海洋深邃 6 色 — v14 把 #1F2933 深炭换 #5B7A95 雾蓝（黑底可见性更好）
// C: 春日花园 6 色 — v14 重做（樱花/嫩柳/晴空/油菜花/紫薇/暖白）
export const GROUP_PALETTES: string[][] = [
  // A — Portra 暖橙 / Fuji 青绿 / Cinestill 红 / Ektachrome 蓝 /
  //     高光奶油 / 阴影巧克力 / 紫调阴影 / CN16 草绿
  ['#D8A878','#7EA898','#A83A3A','#6A7898','#E8D8B8','#382828','#B8A8C8','#9AA878'],
  // B — 莓紫雾蓝 5 色：莓紫 / 雾蓝 / 杏色 / 钢灰 / 红粉
  ['#9B6B8E','#7A8FA3','#D4C0B0','#4A5566','#C97B7B'],
  // C — 莓紫绿粉 5 色（v19 回退 v15 + 把钢灰换成蜜蜡黄稍亮一点）
  // 莓紫 / 鼠尾草绿 / 薰衣草紫 / 蜜蜡黄（稍亮）/ 红粉
  ['#9B6B8E','#7A9B7D','#B5A0C5','#D8B888','#C97B7B'],
];

export type GroupId = 'A' | 'B' | 'C';

export interface GroupDef {
  id: GroupId;
  label: string;
  color: string; // tab pip 颜色（用每个 palette 的第一色）
}

export const GROUPS: GroupDef[] = [
  { id: 'A', label: 'A', color: GROUP_PALETTES[0][0] },
  { id: 'B', label: 'B', color: GROUP_PALETTES[1][0] },
  { id: 'C', label: 'C', color: GROUP_PALETTES[2][0] },
];

export const CFG = {
  minR: 13,
  maxR: 50,
  charge: 280,
  linkBaseDist: 90,
  linkVariance: 110,
  slideMs: 420,
};

export interface SimNode extends SimulationNodeDatum {
  id: string;
  track: Track;
  groupId: GroupId;
  importance: number;
  radius: number;
  color: string;
  /** Phase 6 B2.1 v6 — 0..N 之间的 cluster 索引，让节点形成几个聚落而非平均分布 */
  cluster: number;
  _dragged?: boolean;
}

export const CLUSTER_COUNT = 7;
export const OUTLIER_PCT = 22;

/** deterministic 字符串哈希（generateLinks 和 setupSimulation 共用，保证 cluster 归属一致）*/
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) & 0xffffffff) >>> 0;
  return h;
}

/** 节点 cluster 归属：-1 = outlier，否则 0..CLUSTER_COUNT-1 */
export function getNodeCluster(node: SimNode): number {
  const h = hashStr(node.id);
  if (h % 100 < OUTLIER_PCT) return -1;
  return h % CLUSTER_COUNT;
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

/**
 * 用户测试模式（2026-04-27）：3 个 group 显示相同的 36 首（前 36 周），
 * 让 ABC 用各自 palette 给同一批数据上色，对比颜色效果
 *
 * 后续如恢复"按 week % 3 严格分 36+36+36"，把 .filter(w<=36) 改回 trackGroupId 比对即可
 */
export function getGroupTracks(_gid: GroupId, allTracks: Track[]): Track[] {
  return allTracks.filter((t) => t.week >= 1 && t.week <= 36);
}

/**
 * DB 数据 < target 时循环复用 padding（v4 适配 DB 仅 5 首样本）
 * padded 节点改 week 1..target 让颜色 / size 各异；id 加后缀避免 React key 冲突
 */
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

/**
 * week 派生 importance（0.30-0.95）+ 颜色（按 currentGroupId 选 palette + shade）
 * 全 deterministic：同一 (week, groupId) 永远拿同一 size + 颜色
 */
export function computeNodeAttrs(
  track: Track,
  groupId: GroupId,
): {
  groupId: GroupId;
  importance: number;
  radius: number;
  color: string;
  cluster: number;
} {
  const importance = 0.30 + ((track.week * 13) % 65) / 100;
  const radius = CFG.minR + importance * (CFG.maxR - CFG.minR);
  const groupIdx = GROUPS.findIndex((g) => g.id === groupId);
  const palette = GROUP_PALETTES[groupIdx];
  const shadeIdx = (track.week - 1) % palette.length;
  // cluster 用 week 派生但跟 group 不同模数，让聚落分布看起来不像规则切片
  const cluster = ((track.week * 7) % CLUSTER_COUNT + CLUSTER_COUNT) % CLUSTER_COUNT;
  return {
    groupId,
    importance,
    radius,
    color: palette[shadeIdx],
    cluster,
  };
}

/**
 * v15 — 聚落式 link 拓扑：仅同一 cluster 内的节点之间生成 link。
 * link 拉力方向 = cluster anchor 拉力方向（一致），不会撕裂聚落。
 * 用 getNodeCluster 算 cluster 归属（与 setupSimulation 共用），保证一致。
 * Outlier 节点完全无 link（孤立散点）。
 */
export function generateLinks(nodes: SimNode[]): SimLink[] {
  const links: SimLink[] = [];
  const clusterMembers = new Map<number, number[]>();
  nodes.forEach((n, i) => {
    const c = getNodeCluster(n);
    if (c < 0) return;
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

  return links;
}
