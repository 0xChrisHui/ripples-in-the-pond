/**
 * /lens 光圈期间"月光静止"：目标 0/1，渲染每帧调 stepLensCalm() 取缓动后的 0..1（约 0.4 秒淡入淡出，与遮罩同速）。
 * 为 1 时合成 shader 不再叠加随时间游走 / 随按键起伏的月光项（焦散、倒影、涟漪月光高光），
 * 水下球的环境月光改为固定值 → 光圈里看到的亮度恒定，不再忽明忽暗。
 */
const FADE_SECONDS = 0.4;
let target = 0;
let mix = 0;
let last = 0;

export function setLensCalm(on: boolean): void { target = on ? 1 : 0; }

export function stepLensCalm(nowSeconds: number): number {
  const dt = last === 0 ? 0 : Math.min(0.1, Math.max(0, nowSeconds - last));
  last = nowSeconds;
  const step = dt / FADE_SECONDS;
  mix = target > mix ? Math.min(target, mix + step) : Math.max(target, mix - step);
  return mix;
}
