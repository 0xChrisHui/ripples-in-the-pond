/**
 * /lens 光圈自带月光：光圈所到之处（圆心 + 半径，与遮罩的洞同步）用一层固定的冷光取代游走的月光，
 * 光圈外的月光照常活动（被黑色遮罩压暗地透出来）。→ 光圈内亮度恒定，光圈外保留月光效果。
 * 光圈由 use-lens-frame 每帧写入（屏幕像素）；合成 shader 读缓动后的开关 stepLensCalm（约 0.4 秒淡入淡出，与遮罩同速）。
 */
const FADE_SECONDS = 0.4;
let target = 0;
let mix = 0;
let last = 0;
const ring = { x: 0, y: 0, r: 0, w: 1, h: 1 }; // w/h = 写入时的视口像素尺寸

export function setLensCalm(on: boolean): void { target = on ? 1 : 0; }
export function setLensRing(x: number, y: number, r: number, w: number, h: number): void {
  ring.x = x; ring.y = y; ring.r = r; ring.w = w; ring.h = h;
}
export function getLensRing(): Readonly<typeof ring> { return ring; }

export function stepLensCalm(nowSeconds: number): number {
  const dt = last === 0 ? 0 : Math.min(0.1, Math.max(0, nowSeconds - last));
  last = nowSeconds;
  const step = dt / FADE_SECONDS;
  mix = target > mix ? Math.min(target, mix + step) : Math.max(target, mix - step);
  return mix;
}
