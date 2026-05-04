'use client';

import { useMemo, useState } from 'react';
import type { Track } from '@/src/types/tracks';
import type { EffectsConfig } from './effects-config';

/**
 * 单个球体节点（圆 + ripple + 标题 + hover-ring + play-icon）
 * 颜色 / 半径 / importance / groupId 由 SphereCanvas 计算后 props 传入
 */

interface Props {
  track: Track;
  importance: number;
  radius: number;
  color: string;
  isPlaying: boolean;
  isAnyPlaying?: boolean;
  alreadyMinted: boolean;
  onMinted: (tokenId: number) => void;
  onTogglePlay: () => void;
  effects?: EffectsConfig;
}

const PLAY_PATH = 'M-4.5,-6 L7,0 L-4.5,6 Z';
const PAUSE_PATH = 'M-5.5,-6 L-2,-6 L-2,6 L-5.5,6 Z M0.5,-6 L4,-6 L4,6 L0.5,6 Z';

export default function SphereNode({
  track,
  importance,
  radius,
  color,
  isPlaying,
  isAnyPlaying = false,
  onTogglePlay,
  effects,
}: Props) {
  const [hovered, setHovered] = useState(false);

  const baseOpacity = 0.52 + importance * 0.36;
  const showOverlay = hovered || isPlaying;
  const renderRadius = hovered ? radius * 1.09 : radius;
  const filterUrl = hovered ? 'url(#glow-strong)' : 'url(#glow-soft)';
  // v87 — gradientGlow 开关：true 走 C 方案 radial gradient halo + 实色 body 双 circle；
  // false（默认）走 A 方案 SVG filter（GPU feGaussianBlur）
  const useGradient = effects?.gradientGlow ?? false;
  const haloUrl = hovered ? 'url(#halo-strong)' : 'url(#halo-soft)';
  const renderFill =
    isPlaying || (hovered && isAnyPlaying) ? '#ffffff' : color;
  const rippleStroke = isAnyPlaying ? '#ffffff' : color;
  const rippleTiming = useMemo(() => {
    let h = 0;
    for (let i = 0; i < track.id.length; i++) h = (h * 31 + track.id.charCodeAt(i)) >>> 0;
    const duration = 7.2 + (h % 5400) / 1000;
    return [0, 1, 2].map((i) => ({
      duration,
      delay: -(((h >>> (i * 5 + 3)) % 12600) / 1000),
    }));
  }, [track.id]);

  return (
    <g
      data-sphere
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {effects?.sphereRipple && rippleTiming.map((rt, i) => (
        <circle
          key={i}
          r={radius}
          fill="none"
          stroke={rippleStroke}
          className="ripple-c"
          style={{ animationDuration: `${rt.duration}s`, animationDelay: `${rt.delay}s` }}
        />
      ))}

      {/* v87 C 方案：halo gradient circle 在 body 之下；不接收 click（pointer-events: none） */}
      {useGradient && (
        <circle
          r={renderRadius * 1.16}
          fill={haloUrl}
          style={{ color: renderFill, pointerEvents: 'none' }}
        />
      )}

      <circle
        r={renderRadius}
        fill={renderFill}
        fillOpacity={isPlaying ? Math.min(0.95, baseOpacity + 0.2) : baseOpacity}
        filter={useGradient ? undefined : filterUrl}
        style={{
          cursor: 'pointer',
          transition: 'r 0.22s ease, fill-opacity 0.3s, fill 0.2s',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
      />

      {/* B6 — Modak 气球字内嵌数字 badge：球内右下九宫格中心向球心收 30%
           fill-opacity hover 微亮（0.32 → 0.55）；字号 *3 后所有球都能看清，无需 radius 阈值 */}
      <text
        x={radius * 0.55}
        y={radius * 0.55}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={radius * 1.26}
        fontFamily="var(--font-modak), sans-serif"
        fontWeight={400}
        fill="#ffffff"
        fillOpacity={hovered ? 0.55 : 0.32}
        pointerEvents="none"
        style={{ transition: 'fill-opacity 0.25s ease' }}
      >
        {track.title}
      </text>

      <circle
        r={13}
        fill="rgba(0,0,0,0.55)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1}
        opacity={showOverlay ? 1 : 0}
        style={{ transition: 'opacity 0.2s', pointerEvents: 'none' }}
      />

      <path
        d={isPlaying ? PAUSE_PATH : PLAY_PATH}
        fill="white"
        opacity={showOverlay ? 1 : 0}
        style={{ transition: 'opacity 0.2s', pointerEvents: 'none' }}
      />
    </g>
  );
}
