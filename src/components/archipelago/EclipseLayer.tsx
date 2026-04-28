'use client';

interface Props {
  zoomGRef: React.RefObject<SVGGElement | null>;
  eclipseGRef: React.RefObject<SVGGElement | null>;
}

/**
 * Phase 6 B2 — 日食覆盖层
 *
 * 独立 fixed z-[55] svg，确保**最上层**（高于按键动画 z-40）。
 * 跟随 SphereCanvas 的 zoom transform（zoomGRef 由 SphereCanvas 同步），
 * eclipseGRef 在 tick 中被 SphereCanvas 命令式 set transform / display。
 *
 * 几何按 unit r=50（黑圆 = SphereNode r）；运行时 transform 含 scale(playingNode.radius/50)。
 *
 * v2 调整（用户反馈）：
 * - 光圈范围延展：halo r 110 → 220（外缘扩大 2x）
 * - 内核更亮：opacity peak 0.55 → 0.95
 * - 内核紧贴黑圆：gradient stop 22% 起，与 SphereNode ripple（r→1.6r）重叠
 */
export default function EclipseLayer({ zoomGRef, eclipseGRef }: Props) {
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[55] h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="eclipse-halo">
          {/* 黑圆内透明（避免光晕灼穿月亮）*/}
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="22%" stopColor="white" stopOpacity="0" />
          {/* 紧贴黑圆边缘（unit r=50 处）— 内核最亮，与 ripple 起点重叠 */}
          <stop offset="24%" stopColor="white" stopOpacity="0.95" />
          {/* ripple 边缘（unit r=80 ~ 36%）— 仍较亮 */}
          <stop offset="36%" stopColor="white" stopOpacity="0.65" />
          {/* 中段过渡 */}
          <stop offset="60%" stopColor="white" stopOpacity="0.25" />
          {/* 外缘渐没（unit r=220 = 4.4x 黑圆）*/}
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={zoomGRef}>
        <g ref={eclipseGRef} style={{ display: 'none' }}>
          {/* 减淡白光（外圈光环）— 范围 r=220 = 4.4x 黑圆 */}
          <circle r="220" fill="url(#eclipse-halo)" />
          {/* 月亮（圆变黑）— 紧贴 SphereNode r=50 */}
          <circle r="50" fill="black" />
          {/* 中间暂停键 — 透明度 10% */}
          <rect x="-14" y="-22" width="9" height="44" fill="white" opacity="0.1" />
          <rect x="5" y="-22" width="9" height="44" fill="white" opacity="0.1" />
        </g>
      </g>
    </svg>
  );
}
