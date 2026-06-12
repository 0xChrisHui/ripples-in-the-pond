'use client';

import { MOON_ANCHOR } from '../render/render-helpers';

/**
 * P8-B §2.3 — 水滴质感叠层（从 SphereNode 抽出以守 220 行硬线）。
 *
 * 主球 fill 在 SphereNode 换成 url(#drop-body)；本组件叠 3 个 pointerEvents:none 图层
 * （不碰 onClick）：
 *   1. 主高光 ellipse（specHighlight）—— 方位由 MOON_ANCHOR 派生（光源偏左上 → 高光落左上）
 *   2. 底部内反光 ellipse（rim 反方向，模拟水珠底部透光）
 *   3. rim light 弧（描边 ellipse，光源侧亮边）
 *
 * 可选呼吸/流光：
 *   - dropShimmer：主高光 opacity 呼吸（CSS class drop-shimmer，hash 错峰 delay 内联）
 *   - sphereSheen：斜向高光带缓慢扫过（单层 linearGradient + transform keyframe）
 *
 * keyframe 全在 app/pond-effects.css 的「Lane A 球体线」区块。
 */

interface Props {
  radius: number;
  /** hash 0~1，用于呼吸/流光错峰 delay */
  hash01: number;
  shimmer: boolean;
  sheen: boolean;
}

export default function SphereDropLayers({ radius, hash01, shimmer, sheen }: Props) {
  // 主高光中心：光源在 MOON_ANCHOR（左上），高光落在球面同侧、约 0.4r 处
  const sx = MOON_ANCHOR.x * radius * 0.9;   // 偏左（MOON_ANCHOR.x=0.35）
  const sy = MOON_ANCHOR.y * radius * 0.9 - radius * 0.34; // 偏上
  const specRx = radius * 0.42;
  const specRy = radius * 0.3;
  // 底部内反光：球底偏右下，弱白
  const innerY = radius * 0.5;
  const innerX = radius * 0.18;

  // 错峰 delay：shimmer 4~7s、sheen 8~15s，用同一 hash 派生负 delay 打散相位
  const shimmerDelay = -(hash01 * 6).toFixed(2);
  const sheenDelay = -(hash01 * 13).toFixed(2);
  const sheenId = `sheen-${hash01.toFixed(4)}`;
  const sheenClip = `sheen-clip-${hash01.toFixed(4)}`;

  return (
    <g pointerEvents="none" style={{ pointerEvents: 'none' }}>
      {/* 3. rim light：光源对侧的亮边弧（描边 ellipse，仅露一小段靠右下） */}
      <ellipse
        cx={radius * 0.12}
        cy={radius * 0.16}
        rx={radius * 0.92}
        ry={radius * 0.92}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.14}
        strokeWidth={radius * 0.06}
      />

      {/* 2. 底部内反光 */}
      <ellipse
        cx={innerX}
        cy={innerY}
        rx={radius * 0.5}
        ry={radius * 0.28}
        fill="#ffffff"
        opacity={0.1}
      />

      {/* 1. 主高光（dropShimmer 时挂 opacity 呼吸 class） */}
      <ellipse
        cx={sx}
        cy={sy}
        rx={specRx}
        ry={specRy}
        fill="url(#drop-spec)"
        className={shimmer ? 'drop-shimmer' : undefined}
        style={shimmer ? { animationDelay: `${shimmerDelay}s` } : undefined}
        opacity={0.85}
      />

      {/* F5 sphereSheen：球内 clip 一条斜向高光带缓慢扫过 */}
      {sheen && (
        <>
          <defs>
            <clipPath id={sheenClip}>
              <circle r={radius} />
            </clipPath>
            <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g clipPath={`url(#${sheenClip})`}>
            <rect
              x={-radius * 2}
              y={-radius * 0.5}
              width={radius * 1.1}
              height={radius * 1.0}
              fill={`url(#${sheenId})`}
              className="sphere-sheen"
              style={{ animationDelay: `${sheenDelay}s`, transformBox: 'fill-box' }}
            />
          </g>
        </>
      )}
    </g>
  );
}
