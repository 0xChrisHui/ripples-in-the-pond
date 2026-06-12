'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '@/src/types/tracks';
import type { EffectsConfig } from './effects-config';
import SphereDropLayers from './sphere/SphereDropLayers';
import { usePondTilt } from './hooks/pond/use-pond-tilt';
import {
  acquireWaterFilterDriver,
  releaseWaterFilterDriver,
} from './hooks/pond/use-water-field';

/**
 * 单个球体节点（涟漪 + body + 标题 + hover-ring + play-icon）。
 * 结构（bobbing 内层 g 给 Lane E splashIntro 复用）：
 *   <g data-sphere>          ← hover handlers；d3 transform 在更外层 <g data-z>（SphereCanvas）
 *     <g data-bob>           ← bobbing CSS keyframe 浮沉/微旋，d3 不碰它
 *       ripples / body / drop layers / badge / overlay
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

/** track.id → 稳定 hash（错峰 delay / 周期用） */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

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
  const tilt = usePondTilt();
  const lastHoverSpawn = useRef(0);

  const baseOpacity = 0.52 + importance * 0.36;
  const showOverlay = hovered || isPlaying;
  const renderRadius = hovered ? radius * 1.09 : radius;
  const filterUrl = hovered ? 'url(#glow-strong)' : 'url(#glow-soft)';
  const useGradient = effects?.gradientGlow ?? false;
  // §2.3 — waterDrop 与 gradientGlow 互斥：waterDrop=1 时忽略 gradientGlow 分支
  const useDrop = effects?.waterDrop ?? false;
  const haloUrl = hovered ? 'url(#halo-strong)' : 'url(#halo-soft)';
  const renderFill = isPlaying || (hovered && isAnyPlaying) ? '#ffffff' : color;
  // §2.2 — 播放态涟漪用月光色 token（兼容值 = 白），非播放态用球色
  const rippleStroke = isAnyPlaying ? 'var(--pond-light)' : color;

  const h = useMemo(() => hashId(track.id), [track.id]);
  const hash01 = (h % 10000) / 10000;
  const rippleTiming = useMemo(
    () => [0, 1, 2].map((i) => ({
      duration: 7.2 + (h % 5400) / 1000,
      delay: -(((h >>> (i * 5 + 3)) % 12600) / 1000),
    })),
    [h],
  );

  // P8-A — waterRipple 共享滤镜驱动：开 flag 时 acquire，关/卸载时 release（ref-counted）
  const waterRipple = effects?.waterRipple ?? false;
  const waterScale = effects?.waterRippleScale ?? 12;
  useEffect(() => {
    if (!waterRipple) return;
    acquireWaterFilterDriver(waterScale);
    return () => releaseWaterFilterDriver();
  }, [waterRipple, waterScale]);

  // §2.18 — bobbing 内层 g：CSS keyframe 浮沉 + 微旋，hash 错峰；周期 4.5s/6.7s 不可通约
  const bobbing = effects?.bobbing ?? false;
  const bobStyle = bobbing
    ? {
        animationDelay: `${-(hash01 * 9).toFixed(2)}s, ${-(hash01 * 11).toFixed(2)}s`,
        transformBox: 'fill-box' as const,
        transformOrigin: 'center' as const,
      }
    : undefined;
  const waterFilter = waterRipple ? 'url(#water-ripple)' : undefined;

  // §2.14 hoverRipple — hover 进入瞬间在指尖处发一圈一次性小涟漪（每球 ≥800ms 节流）
  const handleEnter = (e: React.MouseEvent) => {
    setHovered(true);
    if (!effects?.hoverRipple) return;
    if (e.timeStamp - lastHoverSpawn.current < 800) return;
    lastHoverSpawn.current = e.timeStamp;
    window.dispatchEvent(
      new CustomEvent('bg-ripple:spawn', {
        detail: { x: e.clientX, y: e.clientY, size: radius * 2.2, duration: 5, prio: 1, once: true },
      }),
    );
  };

  return (
    <g data-sphere onMouseEnter={handleEnter} onMouseLeave={() => setHovered(false)}>
      <g data-bob className={bobbing ? 'sphere-bob' : undefined} style={bobStyle}>
        {effects?.sphereRipple && rippleTiming.map((rt, i) => (
          <ellipse
            key={i}
            rx={radius}
            ry={radius * tilt}
            cy={radius * 0.45 * (1 - tilt)}
            fill="none"
            className="ripple-c"
            style={{ stroke: rippleStroke, animationDuration: `${rt.duration}s`, animationDelay: `${rt.delay}s` }}
          />
        ))}

        {/* C 方案 halo（waterDrop 开时跳过：drop 自带质感，避免双重光晕） */}
        {useGradient && !useDrop && (
          <circle
            r={renderRadius * 1.16}
            fill={haloUrl}
            style={{ color: renderFill, pointerEvents: 'none' }}
          />
        )}

        {/* 水波折射层：body + drop 叠层一起套 #water-ripple，onClick 仍在 body circle */}
        <g filter={waterFilter}>
          <circle
            r={renderRadius}
            fill={useDrop ? 'url(#drop-body)' : renderFill}
            fillOpacity={isPlaying ? Math.min(0.95, baseOpacity + 0.2) : baseOpacity}
            filter={useDrop || useGradient ? undefined : filterUrl}
            style={{
              color: useDrop ? renderFill : undefined,
              cursor: 'pointer',
              transition: 'r 0.22s ease, fill-opacity 0.3s, fill 0.2s',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
          />

          {useDrop && (
            <SphereDropLayers
              radius={renderRadius}
              hash01={hash01}
              shimmer={effects?.dropShimmer ?? false}
              sheen={effects?.sphereSheen ?? false}
            />
          )}
        </g>

        <text
          x={radius * 0.55}
          y={radius * 0.55}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={radius * ((track.title?.length ?? 1) >= 2 ? 1.0 : 1.26)}
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
    </g>
  );
}
