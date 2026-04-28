/**
 * SVG glow filters（feGaussianBlur）— 抽出复用，避免 SphereCanvas 超 200 行
 * 来自 sound-spheres line 295-303
 */
export default function SphereGlowDefs() {
  return (
    <defs>
      {/* v20 — stdDeviation 进一步降到 2/4（放大闪烁继续优化）*/}
      <filter id="glow-soft" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation={2} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={4} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
