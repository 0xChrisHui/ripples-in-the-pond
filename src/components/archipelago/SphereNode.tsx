'use client';

import { useMemo, useState } from 'react';
import type { Track } from '@/src/types/tracks';
import { useFavorite } from '@/src/hooks/useFavorite';

/**
 * 单个球体节点的 React 内容（圆 + ripple + 标题 + 心形 + hover-ring + play-icon）
 *
 * Phase 6 B2.1 v3 — 完整复现 sound-spheres 视觉：
 * - glow-soft / glow-strong filter（SVG defs 在 SphereCanvas 里）
 * - hover 时主圆放大 1.09 + 切到 glow-strong + hover-ring & play-icon ▶ opacity 0→1
 * - 播放时 play-icon 切 ❚❚ + hover-ring 持续显示
 * - rune-time hover state 走 React onMouseEnter/Leave（D3 不重启）
 *
 * 颜色 / 半径 / importance / groupId 由 SphereCanvas 计算后 props 传入
 */

interface Props {
  track: Track;
  importance: number;
  radius: number;
  color: string;
  isPlaying: boolean;
  /** 是否有任何圆正在播放（日食模式中），hover 加粗效果改白色 */
  isAnyPlaying?: boolean;
  alreadyMinted: boolean;
  onMinted: (tokenId: number) => void;
  onTogglePlay: () => void;
}

// sound-spheres line 659 ▶ path
const PLAY_PATH = 'M-4.5,-6 L7,0 L-4.5,6 Z';
// sound-spheres line 723 ❚❚ path
const PAUSE_PATH = 'M-5.5,-6 L-2,-6 L-2,6 L-5.5,6 Z M0.5,-6 L4,-6 L4,6 L0.5,6 Z';

export default function SphereNode({
  track,
  importance,
  radius,
  color,
  isPlaying,
  isAnyPlaying = false,
  alreadyMinted,
  onMinted,
  onTogglePlay,
}: Props) {
  const { status, favorite } = useFavorite(track.week, track.id, onMinted);
  const isMinted = alreadyMinted || status === 'success';
  const [hovered, setHovered] = useState(false);

  // sound-spheres 的 fill-opacity 公式：0.52 + importance * 0.36
  const baseOpacity = 0.52 + importance * 0.36;
  const showOverlay = hovered || isPlaying;
  const renderRadius = hovered ? radius * 1.09 : radius;
  const filterUrl = hovered ? 'url(#glow-strong)' : 'url(#glow-soft)';
  // 日食模式下：playing 圆 + hover 圆 fill 改白（消除彩色 glow 雾带）
  const renderFill =
    isPlaying || (hovered && isAnyPlaying) ? '#ffffff' : color;
  // 日食模式下 ripple stroke 改白
  const rippleStroke = isAnyPlaying ? '#ffffff' : color;
  // 每个 SphereNode 独立的 ripple 节奏（deterministic，避免 Math.random in render）
  const rippleTiming = useMemo(() => {
    let h = 0;
    for (let i = 0; i < track.id.length; i++) h = (h * 31 + track.id.charCodeAt(i)) >>> 0;
    const duration = 2.4 + (h % 1800) / 1000; // 2.4-4.2s
    return [0, 1, 2].map((i) => ({
      duration,
      delay: -(((h >>> (i * 7 + 3)) % 4200) / 1000),
    }));
  }, [track.id]);

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 3 圈 ripple 涟漪（每节点独立随机节奏；日食模式 stroke 改白）*/}
      {rippleTiming.map((rt, i) => (
        <circle
          key={i}
          r={radius}
          fill="none"
          stroke={rippleStroke}
          strokeWidth={1.3}
          className="ripple-c"
          style={{ animationDuration: `${rt.duration}s`, animationDelay: `${rt.delay}s` }}
        />
      ))}

      {/* 主节点圆（glow filter + hover 放大；日食时 hover 改白）*/}
      <circle
        r={renderRadius}
        fill={renderFill}
        fillOpacity={isPlaying ? Math.min(0.95, baseOpacity + 0.2) : baseOpacity}
        filter={filterUrl}
        style={{
          cursor: 'pointer',
          transition: 'r 0.22s ease, fill-opacity 0.3s, fill 0.2s',
        }}
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
        fontFamily="var(--font-azeret), monospace"
      >
        {track.title.length > 13 ? track.title.slice(0, 12) + '…' : track.title}
      </text>

      {/* hover-ring（hover / playing 时显示）— sound-spheres line 651-653 */}
      <circle
        r={13}
        fill="rgba(0,0,0,0.55)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1}
        opacity={showOverlay ? 1 : 0}
        style={{ transition: 'opacity 0.2s', pointerEvents: 'none' }}
      />

      {/* play-icon（hover/playing 时显示；playing 时切 ❚❚）*/}
      <path
        d={isPlaying ? PAUSE_PATH : PLAY_PATH}
        fill="white"
        opacity={showOverlay ? 1 : 0}
        style={{ transition: 'opacity 0.2s', pointerEvents: 'none' }}
      />

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
    </g>
  );
}
