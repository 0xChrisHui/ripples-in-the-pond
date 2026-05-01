/**
 * SVG glow defs — A 方案 filter（feGaussianBlur）+ C 方案 radial gradient（v87）
 *
 * SphereNode 根据 effects.gradientGlow 选择走哪条：
 *   false → filter url(#glow-soft) / url(#glow-strong)（GPU 卷积，质感真）
 *   true  → fill url(#halo-soft) / url(#halo-strong) + 双层 circle（数学函数，省 GPU）
 *
 * 两套 def 同时存在；切换在 SphereNode 那里做。
 */
export default function SphereGlowDefs() {
  return (
    <defs>
      {/* === A 方案：feGaussianBlur filter（v87 perf — region 缩到 150%/160%，
          stdDev 2→1.2 / 4→2.5；objectBoundingBox 模式 region 随 scale 平方放大，
          缩 region + kernel 把 GPU 工作量降到原 ~24%） === */}
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

      {/* === C 方案：radial gradient halo（每像素 1 次插值，比 filter 卷积省 ~144×；
          缩放无成本，GPU 工作量 O(像素数)，不会随 scale 平方爆炸）。
          currentColor 让一份 gradient 服务所有球颜色——SphereNode 通过 style.color 注入。
          stop 曲线：0-86% 平台（halo 内圈接 body 边缘），86%-100% 多 stop 模拟 Gaussian 衰减 === */}
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
    </defs>
  );
}
