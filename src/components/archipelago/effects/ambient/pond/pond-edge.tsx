'use client';

/**
 * 塘岸暗缘 (P8-F F1 pondEdge) — 全屏静态羽化暗角框，暗示"这是一口塘不是无限宇宙"。
 *
 * 零动画、pointer-events:none。两层径向渐变错位叠加做不规则暗缘感，
 * 抽象合规（只是暗角光衰，无任何具象轮廓）。
 */
export default function PondEdge() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
    >
      {/* 主暗角：中心透、四缘暗 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 48%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.45) 100%)',
        }}
      />
      {/* 错位次层：偏左上一点，让暗缘不规则（避免对称工业感） */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(135% 115% at 44% 40%, rgba(0,0,0,0) 64%, rgba(0,0,0,0.30) 100%)',
        }}
      />
    </div>
  );
}
