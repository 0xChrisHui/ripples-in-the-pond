import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Track } from '@/src/types/tracks';

/**
 * Phase 6 B2.1 — sound-spheres 的配置 + 节点/链接生成纯函数
 * 抽出来方便调色 / 调参 / 改 link 密度（不动 React/D3 渲染逻辑）
 *
 * 用户决策（2026-04-27）：3 group A/B/C 各 36 首；不做跨 group 虚线圈
 */

// 3 group palette（用户 v7 自定配色，2026-04-27）
// A: Portra 暖橙系 8 色 / B: 复古印刷系 6 色 / C: 荧光实验系 8 色
// shadeIdx 用 % palette.length 处理不等长
export const GROUP_PALETTES: string[][] = [
  // A — Portra 暖橙 / Fuji 青绿 / Cinestill 红 / Ektachrome 蓝 /
  //     高光奶油 / 阴影巧克力 / 紫调阴影 / CN16 草绿
  ['#D8A878','#7EA898','#A83A3A','#6A7898','#E8D8B8','#382828','#B8A8C8','#9AA878'],
  // B — Warm Red / Yellow / Forest / Burgundy / Newsprint / Sienna
  ['#A82A32','#E8C83A','#0A3A2E','#4A2A3C','#C8B8A0','#7A3A2A'],
  // C — 伊红 / Cy5 荧光 / 黄金切片 / DAPI 紫 / 钴蓝盐 / GFP 绿 / 铬橙 / 盐结晶
  ['#FF3A78','#3AFFE8','#FFE83A','#A83AFF','#3A8AFF','#48D878','#FF8A3A','#E8E8D8'],
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
 * 节点间 link（作 force 稳定力，不渲染 line）
 * 按 sound-spheres line 482-497 的 deterministic seed
 * 36 节点 / group（接近原版 47），密度系数恢复到原版 0.56
 */
export function generateLinks(nodes: SimNode[]): SimLink[] {
  const links: SimLink[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const seed = ((a.track.week * 17 + b.track.week * 31 + a.track.week * b.track.week) % 97) / 97;
      const avgImp = (a.importance + b.importance) / 2;
      if (seed < avgImp * 0.56) {
        const corr = 0.18 + ((a.track.week * 3 + b.track.week * 7) % 10) / 13;
        links.push({ source: a.id, target: b.id, correlation: Math.min(0.95, corr) });
      }
    }
  }
  return links;
}
