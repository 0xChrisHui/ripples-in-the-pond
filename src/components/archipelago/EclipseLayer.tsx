'use client';

interface Props {
  zoomGRef: React.RefObject<SVGGElement | null>;
  eclipseGRef: React.RefObject<SVGGElement | null>;
}

/**
 * Phase 6 B2 — 日食覆盖层
 *
 * 独立 fixed z-[55] svg，确保**最上层**（高于按键动画 z-40 + 任何 SphereCanvas 内的元素）。
 * 跟随 SphereCanvas 的 zoom transform（zoomGRef 由 SphereCanvas 同步），
 * eclipseGRef 在 tick 中被 SphereCanvas 命令式地 set transform / display。
 *
 * 几何按 unit r=50 设计；运行时 transform 含 scale(playingNode.radius/50) 缩到对应大小。
 */
export default function EclipseLayer({ zoomGRef, eclipseGRef }: Props) {
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[55] h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="eclipse-halo">
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="58%" stopColor="white" stopOpacity="0.55" />
          <stop offset="80%" stopColor="white" stopOpacity="0.15" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={zoomGRef}>
        <g ref={eclipseGRef} style={{ display: 'none' }}>
          {/* unit r=50 —— 减淡白光（外圈光环）*/}
          <circle r="110" fill="url(#eclipse-halo)" />
          {/* 月亮（圆变黑）*/}
          <circle r="50" fill="black" />
          {/* 中间暂停键 — 透明度 10% */}
          <rect x="-14" y="-22" width="9" height="44" fill="white" opacity="0.1" />
          <rect x="5" y="-22" width="9" height="44" fill="white" opacity="0.1" />
        </g>
      </g>
    </svg>
  );
}
