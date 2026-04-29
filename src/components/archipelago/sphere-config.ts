import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Track } from '@/src/types/tracks';

/**
 * Phase 6 B2.1 — sound-spheres 的配置 + 节点/链接生成纯函数
 * 抽出来方便调色 / 调参 / 改 link 密度（不动 React/D3 渲染逻辑）
 *
 * 用户决策（2026-04-27）：3 group A/B/C 各 36 首；不做跨 group 虚线圈
 */

// 3 group palette（v26 — B/C 改为 A 删 2 + 加 2 同风格变体，皆 8 色）
// A: Portra 暖橙系 8 色（基底）
// B: Cinestill 800T 夜景 8 色 — A 删暖橙/奶油，加深夜蓝/霓虹红
// C: Ektar 100 鲜艳 8 色 — A 删巧克力/紫调阴影，加鲜橙/翡翠绿
export const GROUP_PALETTES: string[][] = [
  // A — Portra 暖橙 / Fuji 青绿 / Cinestill 红 / Ektachrome 蓝 /
  //     高光奶油 / 阴影巧克力 / 紫调阴影 / CN16 草绿
  ['#D8A878','#7EA898','#A83A3A','#6A7898','#E8D8B8','#382828','#B8A8C8','#9AA878'],
  // B — Vintage Slide + 霓虹红（v29 替换 #A88068 红棕）：Portra 暖橙 / Fuji 青绿 /
  //     高光奶油 / 阴影巧克力 / 紫调阴影 / CN16 草绿 / 霓虹红 / 橄榄
  ['#D8A878','#7EA898','#E8D8B8','#382828','#B8A8C8','#9AA878','#C8504A','#888858'],
  // C — Ektar 100 鲜艳：Portra 暖橙 / Fuji 青绿 / Cinestill 红 / Ektachrome 蓝 /
  //     高光奶油 / CN16 草绿 / 鲜橙 / 翡翠绿
  ['#D8A878','#7EA898','#A83A3A','#6A7898','#E8D8B8','#9AA878','#D88A4A','#5A8868'],
];

export type GroupId = 'A' | 'B' | 'C';

export interface GroupDef {
  id: GroupId;
  label: string;
  color: string; // tab pip 颜色（用每个 palette 的第一色）
}

export const GROUPS: GroupDef[] = [
  { id: 'A', label: '1', color: GROUP_PALETTES[0][0] },
  { id: 'B', label: '2', color: GROUP_PALETTES[1][0] },
  { id: 'C', label: '3', color: GROUP_PALETTES[2][0] },
];

// v31 — 球大小恢复到 v29（9/30），靠减 collide 斥力 + 提 outlier 拉力压总占地
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
  _dragged?: boolean;
}

/** deterministic 字符串哈希（节点 jitter 用，保证位置稳定）*/
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) & 0xffffffff) >>> 0;
  return h;
}

/**
 * v32 — 随机 cluster 划分：每次调用结果不同（用 Math.random，必须在 useEffect 内调用，
 * 不能在 useMemo body 内调用以避免触发 react-hooks/purity）。
 *
 * 大小池 power-law：单球 / 对儿 / 三球 / 大聚落混合，每次刷新组合都不同。
 * 36 球用此池约生成 12 个 cluster，size 1-5 不等。
 *
 * 所有节点都被分到某个 cluster（不再有"outlier"概念）；size=1 的 cluster 自然就是孤立球。
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
} {
  const importance = 0.30 + ((track.week * 13) % 65) / 100;
  const radius = CFG.minR + importance * (CFG.maxR - CFG.minR);
  const groupIdx = GROUPS.findIndex((g) => g.id === groupId);
  const palette = GROUP_PALETTES[groupIdx];
  const shadeIdx = (track.week - 1) % palette.length;
  return {
    groupId,
    importance,
    radius,
    color: palette[shadeIdx],
  };
}

/**
 * v32 — 聚落式 link 拓扑：仅同一 cluster 内的节点之间生成 link。
 * link 拉力方向 = cluster anchor 拉力方向（一致），不会撕裂聚落。
 * 接收 buildClusterAssignment 生成的 assignment（与 setupSimulation 共用，保证一致）。
 * size=1 的 cluster 自然无 link；size=2 形成"对儿"互连；更大 cluster 全连接。
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

  return links;
}
