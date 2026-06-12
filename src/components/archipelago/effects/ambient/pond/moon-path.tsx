'use client';

import { MOON_ANCHOR } from '../../../render/render-helpers';

/**
 * 月光水路 (P8-F F3 moonPath) — 垂直光带（var(--pond-glow) → transparent），
 * 月光在水面拉出的一条竖直反光路。
 *
 * 光向纪律（8-A 补充三）：水平位置由 MOON_ANCHOR.x 派生，禁止写死方位。
 * 2 层错相位极慢明暗摇曳（只动 opacity/transform），宽 ~10% 视口。
 */

// MOON_ANCHOR.x 是视口比例（0.35 = 35%）。光带中心锚在月亮正下方的水面。
const BAND_CX_PCT = MOON_ANCHOR.x * 100;
const BAND_W_PCT = 10; // 视口宽度占比

export default function MoonPath() {
  const left = `${BAND_CX_PCT - BAND_W_PCT / 2}%`;
  // keyframes 在 app/pond-effects.css「Lane B」区块（moonpath-sway-a/b）
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute top-0 bottom-0"
          style={{
            left,
            width: `${BAND_W_PCT}%`,
            background:
              'linear-gradient(to right, transparent 0%, var(--pond-glow) 50%, transparent 100%)',
            animation: 'moonpath-sway-a 26s ease-in-out infinite',
            transformOrigin: 'center',
            willChange: 'transform, opacity',
            opacity: 0.05,
          }}
        />
        <div
          className="absolute top-0 bottom-0"
          style={{
            left,
            width: `${BAND_W_PCT}%`,
            background:
              'linear-gradient(to right, transparent 0%, var(--pond-glow) 50%, transparent 100%)',
            animation: 'moonpath-sway-b 34s ease-in-out infinite',
            animationDelay: '-12s',
            transformOrigin: 'center',
            willChange: 'transform, opacity',
            opacity: 0.04,
          }}
        />
      </div>
    </>
  );
}
