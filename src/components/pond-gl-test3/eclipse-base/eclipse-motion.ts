/** 沿用普通音乐圆约 0.22 秒的 hover 缓动，帧率变化时保持相同体感。 */
export function advanceCircleHover(current: number, hovered: boolean, deltaMs: number, reduced: boolean) {
  if (reduced) return hovered ? 1 : 0;
  return current + ((hovered ? 1 : 0) - current) * (1 - Math.exp(-Math.max(0, deltaMs) / 84));
}

/** 基础日食只呼吸和响应 hover；不依赖首页的按键与展示编舞。 */
export function sampleEclipseBase(time: number, hover: number, reduced: boolean) {
  const wave = reduced ? 0 : Math.sin(time * .85) * .65 + Math.sin(time * 1.37) * .35;
  return { ringWidth: 1.2 + hover * 2.4 + wave * .14,
    haloScale: 1 + wave * .012 + hover * .018,
    haloOpacity: .82 + wave * .06 + hover * .1 };
}
