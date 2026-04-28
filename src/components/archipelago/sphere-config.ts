import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Track } from '@/src/types/tracks';

/**
 * Phase 6 B2.1 — sound-spheres 的配置 + 节点/链接生成纯函数
 * 抽出来方便调色 / 调参 / 改 link 密度（不动 React/D3 渲染逻辑）
 *
 * 用户决策（2026-04-27）：3 group A/B/C 各 36 首；不做跨 group 虚线圈
 */

// 3 group palette
// A: Portra 暖橙系 8 色（保留）/ B: 海洋深邃系 6 色（v13 新）/ C: 森林大地系 8 色（v13 新）
export const GROUP_PALETTES: string[][] = [
  // A — Portra 暖橙 / Fuji 青绿 / Cinestill 红 / Ektachrome 蓝 /
  //     高光奶油 / 阴影巧克力 / 紫调阴影 / CN16 草绿
  ['#D8A878','#7EA898','#A83A3A','#6A7898','#E8D8B8','#382828','#B8A8C8','#9AA878'],
  // B — 海洋深邃：深蓝 / 海绿 / 银白 / 珊瑚 / 星辰金 / 深炭
  ['#1F4D6B','#3A7B82','#C4D2D8','#E89682','#C4A55C','#1F2933'],
  // C — 森林大地：苔绿 / 焦糖 / 橡木 / 米金 / 茶绿 / 土褐 / 烟青 / 麦黄
  ['#4A6F4A','#A86E3D','#6B4F35','#C9A878','#5A7A5A','#6B4632','#4A5C5C','#BFA968'],
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

export const CLUSTER_COUNT = 5;

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
 * v13 重写：聚落式 link 拓扑（不再全节点稠密 cross-link）
 * - 1 中心 hub 节点（importance 最高）连 7-9 个非 outlier 节点
 * - 35% 节点为 outlier 完全无连接（孤零零）
 * - 剩余分 4-6 个 size 4-7 的小集群，集群内全连，集群间不连（"机构洞"）
 * 整体边数从原 ~120 → ~50，视觉上呈现：1 hub + 散点 + 几个小聚落
 */
export function generateLinks(nodes: SimNode[]): SimLink[] {
  const links: SimLink[] = [];
  const N = nodes.length;
  if (N < 5) return links;

  // 1. hub = importance 最高的节点
  let hubIdx = 0;
  for (let i = 1; i < N; i++) {
    if (nodes[i].importance > nodes[hubIdx].importance) hubIdx = i;
  }

  // 2. 决定 outlier（35%，deterministic by week）
  const isOutlier = new Set<number>();
  for (let i = 0; i < N; i++) {
    if (i === hubIdx) continue;
    if ((nodes[i].track.week * 23) % 100 < 35) isOutlier.add(i);
  }

  // 3. hub 连 7-9 个非 outlier 节点
  const hubTargets: number[] = [];
  const hubLimit = 7 + (nodes[hubIdx].track.week % 3);
  for (let i = 0; i < N && hubTargets.length < hubLimit; i++) {
    if (i === hubIdx || isOutlier.has(i)) continue;
    hubTargets.push(i);
  }
  hubTargets.forEach((j) => {
    links.push({
      source: nodes[hubIdx].id,
      target: nodes[j].id,
      correlation: 0.62,
    });
  });

  // 4. 剩余节点（非 hub / 非 hubTarget / 非 outlier）分小集群全连
  const remaining: number[] = [];
  const used = new Set([hubIdx, ...hubTargets, ...Array.from(isOutlier)]);
  for (let i = 0; i < N; i++) if (!used.has(i)) remaining.push(i);

  let p = 0;
  let groupSeed = 0;
  while (p < remaining.length) {
    const size = 4 + (groupSeed % 4); // 集群大小 4-7
    const cluster = remaining.slice(p, p + size);
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const corr = 0.45 + ((cluster[i] + cluster[j] * 3) % 5) / 12;
        links.push({
          source: nodes[cluster[i]].id,
          target: nodes[cluster[j]].id,
          correlation: Math.min(0.85, corr),
        });
      }
    }
    p += size;
    groupSeed++;
  }

  return links;
}
