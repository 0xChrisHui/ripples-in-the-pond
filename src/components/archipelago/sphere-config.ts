import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Track } from '@/src/types/tracks';

/**
 * Phase 6 B2.1 — sound-spheres 的配置 + 节点/链接生成纯函数
 * 抽出来方便调色 / 调参 / 改 link 密度（不动 React/D3 渲染逻辑）
 */

// 4 group × 8 shade = 32 色 palette（来自 sound-spheres line 371-376）
export const GROUP_PALETTES: string[][] = [
  ['#F0A050','#D97828','#F4BC6A','#C46018','#E8883A','#FAD080','#D06820','#F09840'], // orange
  ['#7AAEE8','#5A8ED8','#9ABEF6','#4A7EC8','#88B8F0','#3A6EB8','#A8CCFC','#6898D8'], // blue
  ['#B87AE8','#9A5ED4','#CCA0F8','#8448C0','#D0AAFE','#7038B0','#B888F0','#A068DC'], // violet
  ['#4EC8A0','#34AE86','#6ADAB4','#28987A','#80E4C0','#20886A','#56D4A8','#3AB890'], // green
];

export const CFG = {
  minR: 13,
  maxR: 50,
  charge: 280,
  linkBaseDist: 90,
  linkVariance: 110,
};

export interface SimNode extends SimulationNodeDatum {
  id: string;
  track: Track;
  importance: number;
  radius: number;
  color: string;
  _dragged?: boolean;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  correlation: number;
}

/**
 * week 派生 importance（0.30-0.95）+ 颜色（4 group × 8 shade palette）
 * 全 deterministic — 同一 track.week 永远拿同一 size + 颜色
 */
export function computeNodeAttrs(track: Track): {
  importance: number;
  radius: number;
  color: string;
} {
  const importance = 0.30 + ((track.week * 13) % 65) / 100;
  const radius = CFG.minR + importance * (CFG.maxR - CFG.minR);
  const groupIdx = track.week % GROUP_PALETTES.length;
  const palette = GROUP_PALETTES[groupIdx];
  const shadeIdx = Math.floor(track.week / GROUP_PALETTES.length) % palette.length;
  return { importance, radius, color: palette[shadeIdx] };
}

/**
 * 节点间 link（作 force 稳定力，不渲染 line）
 * 按 sound-spheres line 482-497 的 deterministic seed；密度系数砍半（108 节点比原版 47 节点多）
 */
export function generateLinks(nodes: SimNode[]): SimLink[] {
  const links: SimLink[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const seed = ((a.track.week * 17 + b.track.week * 31 + a.track.week * b.track.week) % 97) / 97;
      const avgImp = (a.importance + b.importance) / 2;
      if (seed < avgImp * 0.28) {
        const corr = 0.18 + ((a.track.week * 3 + b.track.week * 7) % 10) / 13;
        links.push({ source: a.id, target: b.id, correlation: Math.min(0.95, corr) });
      }
    }
  }
  return links;
}
