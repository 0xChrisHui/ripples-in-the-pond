'use client';

import type { Track } from '@/src/types/tracks';
import { useFavorite } from '@/src/hooks/useFavorite';

/**
 * 单个球体节点的 React 内容（圆 + ripple + 标题 + 心形）
 * 每个节点独立 useFavorite 实例 — 108 个 hook 不算重
 *
 * 从 SphereCanvas 拆出（Phase 6 B2.1，220 行硬线）
 */

// 5 种 cover 颜色映射 hex（替代 Tailwind class，SVG fill 用）
const COLOR_HEX: Record<string, string> = {
  blue: '#7AAEE8',
  emerald: '#4EC8A0',
  violet: '#B87AE8',
  amber: '#F0A050',
  rose: '#E96C8E',
};
const DEFAULT_HEX = '#888';

export const NODE_R = 22;

interface Props {
  track: Track;
  isPlaying: boolean;
  alreadyMinted: boolean;
  onMinted: (tokenId: number) => void;
  onTogglePlay: () => void;
}

export default function SphereNode({
  track,
  isPlaying,
  alreadyMinted,
  onMinted,
  onTogglePlay,
}: Props) {
  const { status, favorite } = useFavorite(track.week, track.id, onMinted);
  const isMinted = alreadyMinted || status === 'success';
  const color = COLOR_HEX[track.cover] ?? DEFAULT_HEX;

  return (
    <>
      {/* 3 圈 ripple 涟漪（CSS 动画错峰，定义在 globals.css）*/}
      <circle r={NODE_R} fill="none" stroke={color} strokeWidth={1.3} className="ripple-c ripple-r1" />
      <circle r={NODE_R} fill="none" stroke={color} strokeWidth={1.3} className="ripple-c ripple-r2" />
      <circle r={NODE_R} fill="none" stroke={color} strokeWidth={1.3} className="ripple-c ripple-r3" />

      {/* 主节点圆（点击播放）*/}
      <circle
        r={NODE_R}
        fill={color}
        fillOpacity={isPlaying ? 0.9 : 0.55}
        style={{ cursor: 'pointer', transition: 'fill-opacity 0.3s' }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
      />

      {/* 标题 */}
      <text
        dy={NODE_R + 16}
        textAnchor="middle"
        fontSize={10}
        fill="rgba(255,255,255,0.65)"
        pointerEvents="none"
      >
        {track.title.length > 12 ? track.title.slice(0, 11) + '…' : track.title}
      </text>

      {/* 心形（右上角，点击 useFavorite）*/}
      <g
        transform={`translate(${NODE_R - 4}, ${-NODE_R + 4})`}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          favorite();
        }}
      >
        <circle r={9} fill="rgba(0,0,0,0.5)" />
        <text
          dy={3.5}
          textAnchor="middle"
          fontSize={12}
          fill={isMinted ? '#fb7185' : 'rgba(255,255,255,0.6)'}
          pointerEvents="none"
        >
          {isMinted ? '♥' : '♡'}
        </text>
      </g>
    </>
  );
}
