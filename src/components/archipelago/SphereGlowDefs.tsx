/**
 * SVG glow defs — A 方案 filter（feGaussianBlur）+ C 方案 radial gradient（v87）
 *
 * SphereNode 根据 effects.gradientGlow 选择走哪条：
 *   false → filter url(#glow-soft) / url(#glow-strong)（GPU 卷积，质感真）
 *   true  → fill url(#halo-soft) / url(#halo-strong) + 双层 circle（数学函数，省 GPU）
 *
 * 两套 def 同时存在；切换在 SphereNode 那里做。
 *
 * P8-A / P8-B 追加（Lane A 球体线）：
 *   - #water-ripple：feTurbulence + feDisplacementMap 水下折射。turbulence 静态（baseFrequency/
 *     seed 永不逐帧改，避免每帧重栅格化）；只有 feDisplacementMap.scale 由 use-water-field 在
 *     节流帧更新（全局聚合扰动），region 收紧到 ±20%。与 glow 滤镜叠加用，保 onClick。
 *   - #drop-body / #drop-spec：水滴质感 radial gradient（waterDrop flag 用）。
 */
export default function SphereGlowDefs() {
  return (
    <defs>
      {/* === A 方案：feGaussianBlur filter（v87 perf — region 缩到 150%/160%） === */}
      <filter id="glow-soft" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation={1.2} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-strong" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={2.5} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* === C 方案：radial gradient halo === */}
      <radialGradient id="halo-soft">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
        <stop offset="86%" stopColor="currentColor" stopOpacity="0.3" />
        <stop offset="93%" stopColor="currentColor" stopOpacity="0.15" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="halo-strong">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
        <stop offset="80%" stopColor="currentColor" stopOpacity="0.5" />
        <stop offset="90%" stopColor="currentColor" stopOpacity="0.25" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>

      {/* === P8-A 水下折射：turbulence 静态 + 仅 scale 由 use-water-field 动 ===
          baseFrequency/numOctaves/seed 写死，浏览器内部缓存 turbulence 贴图，零逐帧栅格化。
          feDisplacementMap.scale 初始 0（关 flag = 像素级回现状），运行时由 SphereNode 写。 */}
      <filter
        id="water-ripple"
        x="-20%" y="-20%" width="140%" height="140%"
        filterUnits="objectBoundingBox"
        data-water-filter
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.018 0.024"
          numOctaves={2}
          seed={7}
          stitchTiles="stitch"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale={0}
          xChannelSelector="R"
          yChannelSelector="G"
          data-water-disp
        />
      </filter>

      {/* === P8-B §2.3 水滴质感 ===
          drop-body：主球 fill。currentColor 注入球色；偏左上亮、右下暗，模拟水珠折射。
          drop-spec：主高光 radial（白），方位由 SphereNode 按 MOON_ANCHOR 偏移定位。 */}
      <radialGradient id="drop-body" cx="38%" cy="33%" r="75%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
        <stop offset="55%" stopColor="currentColor" stopOpacity="0.82" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.62" />
      </radialGradient>
      <radialGradient id="drop-spec" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
