'use client';

import type { Track } from '@/src/types/tracks';
import { useFavorite } from '@/src/hooks/useFavorite';

/**
 * 单个球体节点的 React 内容（圆 + ripple + 标题 + 心形）
 * 颜色 / 半径 / importance 由 SphereCanvas 计算后通过 props 传入
 *   （Phase 6 B2.1 v2 完整复现 sound-spheres：每节点不同 size + 4 palette × 8 shade）
 *
 * 每节点独立 useFavorite 实例 — 108 个 hook 不算重
 */

interface Props {
  track: Track;
  importance: number;
  radius: number;
  color: string;
  isPlaying: boolean;
  alreadyMinted: boolean;
  onMinted: (tokenId: number) => void;
  onTogglePlay: () => void;
}

export default function SphereNode({
  track,
  importance,
  radius,
  color,
  isPlaying,
  alreadyMinted,
  onMinted,
  onTogglePlay,
}: Props) {
  const { status, favorite } = useFavorite(track.week, track.id, onMinted);
  const isMinted = alreadyMinted || status === 'success';

  // sound-spheres 的 fill-opacity 公式：0.52 + importance * 0.36
  const baseOpacity = 0.52 + importance * 0.36;

  return (
    <>
      {/* 3 圈 ripple 涟漪（CSS 动画错峰，定义在 globals.css）*/}
      <circle r={radius} fill="none" stroke={color} strokeWidth={1.3} className="ripple-c ripple-r1" />
      <circle r={radius} fill="none" stroke={color} strokeWidth={1.3} className="ripple-c ripple-r2" />
      <circle r={radius} fill="none" stroke={color} strokeWidth={1.3} className="ripple-c ripple-r3" />

      {/* 主节点圆（点击播放）*/}
      <circle
        r={radius}
        fill={color}
        fillOpacity={isPlaying ? Math.min(0.95, baseOpacity + 0.2) : baseOpacity}
        style={{ cursor: 'pointer', transition: 'fill-opacity 0.3s' }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
      />

      {/* 标题（dy 跟随 radius 自适应）*/}
      <text
        dy={radius + 13}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(216,211,200,0.72)"
        pointerEvents="none"
      >
        {track.title.length > 13 ? track.title.slice(0, 12) + '…' : track.title}
      </text>

      {/* 心形（右上角，点击 useFavorite）*/}
      <g
        transform={`translate(${radius - 4}, ${-radius + 4})`}
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
