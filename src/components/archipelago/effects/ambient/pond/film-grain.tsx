'use client';

/**
 * 胶片颗粒 (P8-B §2.17) — 全屏静态颗粒 overlay，让三组胶片色板（Portra/Cinestill/Ektar）统一气质。
 *
 * 性能纪律（§0.3）：feTurbulence(fractalNoise) 只渲染一次（baseFrequency 写死，绝不逐帧动），
 *   静态即可（暗底低 opacity 下静态颗粒不穿帮）。mix-blend-mode: overlay 单层。
 * mix-blend-mode 全屏层纪律：caustics 2 + grain 1 = 3 层，真机压不住时优先把本层降普通叠加。
 */
export default function FilmGrain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
      style={{ mixBlendMode: 'overlay', opacity: 0.04 }}
    >
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <filter id="film-grain-tex" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={11} result="n" />
          {/* 去色 + 压淡：把噪声变成中性灰细颗粒（RGB 同权重，alpha 拉满） */}
          <feColorMatrix
            in="n"
            type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-grain-tex)" />
      </svg>
    </div>
  );
}
