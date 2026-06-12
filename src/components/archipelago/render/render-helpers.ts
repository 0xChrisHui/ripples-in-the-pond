/**
 * v87 — sim tick 公用渲染常量 + 几何 helpers，从 use-sphere-sim 抽出。
 *
 * use-sphere-sim 和 render-links 都用，独立成文件避免循环依赖 + 控制单文件行数。
 */

/** tilt: 远端 baseline 0.15 微动，近端 pow(z,1.2) 偏陡。
 *  P8-B S3（§2.5）— TILT_PX 145→72：水塘视觉里视差幅度收一半，球更像「躺在水面」
 *  随鼠标轻晃而非大幅平移，让水波/bobbing 微动成为主体感。 */
export const TILT_PX = 72;
export const tiltCoef = (z: number): number =>
  0.15 + Math.pow(Math.max(0, z), 1.2) * 0.85;

/**
 * Phase 8 — 全场景统一机位常量。
 *
 * POND_TILT_RATIO_DEFAULT：涟漪等"躺在水面"元素的 ry/rx 透视压扁比。
 *   1.0 = 垂直俯视正圆（= 现状，默认零视觉变化）；<1 = 斜视水面椭圆。
 *   ⚠️ 运行时值不要读这个常量——读 hooks/pond/use-pond-tilt.ts 的响应式值，
 *   否则 /test slider 一动会出现"一半元素压扁一半没压"（违背统一机位的唯一目的）。
 *   本常量仅作 SSR 初值 / store 默认值。
 *
 * MOON_ANCHOR：全场景统一光源锚点（视口比例坐标，画面上方偏左 ≈10-11 点钟）。
 *   水珠高光方位 / 碎光月光带 / 月光水路 / 水中月出现侧，全部由它派生，禁止各处写死方位。
 */
export const POND_TILT_RATIO_DEFAULT = 1.0;
export const MOON_ANCHOR = { x: 0.35, y: -0.1 } as const;

/**
 * 一点透视投影：z 高（近）的球随 k 增长更快。
 * v86: cap 4→8（让边缘 cluster 球飞出屏幕）。
 * v87 Z3: cap 8→4（缩放最大时 SVG filter 区域 1.5×4=6 base bbox vs 1.5×8=12，
 *   面积缩小 4 倍 → GPU feGaussianBlur 像素工作量降到 1/4）
 */
export function persp(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  k: number,
): { x: number; y: number; factor: number } {
  const factor = Math.min(4, Math.pow(k, 0.6 + z * 1.0));
  return { x: cx + (x - cx) * factor, y: cy + (y - cy) * factor, factor };
}

/**
 * v87 G3 — 全局活动追踪。
 *
 * 任何 mousemove/wheel/keydown/click 都会更新 lastActivityTime。
 * sim tick 用 getLastActivityTime() 判断是否进入 idle 模式（5s 无输入 → 半频更新 DOM）。
 *
 * 模块级状态而非 React hook：所有 sim tick 共享一份；只装一次 listener。
 * SSR 安全：window 检查 + 懒初始化。
 */
let lastActivityTime = 0;
let activityTrackingInited = false;

export function getLastActivityTime(): number {
  return lastActivityTime;
}

export function initActivityTracking(): void {
  if (activityTrackingInited || typeof window === 'undefined') return;
  activityTrackingInited = true;
  lastActivityTime = performance.now();
  const update = (): void => { lastActivityTime = performance.now(); };
  window.addEventListener('mousemove', update, { passive: true });
  window.addEventListener('wheel', update, { passive: true });
  window.addEventListener('keydown', update);
  window.addEventListener('click', update);
}
