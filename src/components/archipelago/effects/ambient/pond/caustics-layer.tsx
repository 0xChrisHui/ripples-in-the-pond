'use client';

/**
 * 水焦散网纹 (P8-B §2.7) — aurora 的水塘替身（同样的"缓慢漫流的环境光"角色）。
 *
 * 结构抄 aurora-background：固定全屏 z-[-1] 容器 + 内联 keyframes（transform-only）。
 * 性能纪律（§0.3）：feTurbulence 滤镜只渲染一次（baseFrequency/seed 写死，绝不逐帧动）；
 *   2 层错相位（seed 7 / 13）soft-light 叠加，动的只是合成层 transform/opacity。
 * mix-blend-mode 全屏层：本组件占 2 层（caustics）+ film-grain 1 层 = 3 层硬线，注意自检。
 */

/** 单层静态焦散纹理 SVG —— 滤镜只渲染一次，染成 --pond-glow 色的高对比棱线 */
function CausticsTexture({ seed }: { seed: number }) {
  const fid = `caustics-tex-${seed}`;
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="none">
      <filter id={fid} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="turbulence" baseFrequency="0.012 0.03" numOctaves={2} seed={seed} result="n" />
        {/* alpha 行 9/-3.6：把噪声压成高对比"棱线"窄带；RGB 染近白（接 --pond-glow 现状值） */}
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.96  0 0 0 0 0.94  0 0 0 0 0.86  0 0 0 9 -3.6"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${fid})`} />
    </svg>
  );
}

export default function CausticsLayer() {
  // keyframes 在 app/pond-effects.css「Lane B」区块（caustics-drift-a/b）
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            mixBlendMode: 'soft-light',
            animation: 'caustics-drift-a 72s ease-in-out infinite',
            willChange: 'transform, opacity',
            opacity: 0.06,
          }}
        >
          <CausticsTexture seed={7} />
        </div>
        <div
          className="absolute inset-0"
          style={{
            mixBlendMode: 'soft-light',
            animation: 'caustics-drift-b 90s ease-in-out infinite',
            animationDelay: '-30s',
            willChange: 'transform, opacity',
            opacity: 0.05,
          }}
        >
          <CausticsTexture seed={13} />
        </div>
      </div>
    </>
  );
}
