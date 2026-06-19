'use client';

/**
 * /test3 — 球的「一点透视 + 鼠标视差 + 景深」统一投影。
 *
 * 正交像素相机无内建透视，故在**屏幕空间**按有效深度 d 伪造（d 由 pointer-fx.effDepth() 给出：
 * 层模型默认 35-65，叠滚轮集体偏移）：
 *   ① 一点透视：d 越大(越近) 球越大 + 绕灭点越往外铺（聚散）；d 越小(越远) 越小越收拢 → 滚轮集体靠近/变远；
 *   ② 鼠标视差：按深度分层位移（近球动得多）；
 *   ③ 景深：离对焦面(=固定水位)越远越虚。
 * GL 实例 / DOM 命中层 / 水面遮罩 / 日蚀层都喂同一个 project()（传入同一 effDepth）→ 视觉/点击/水线对齐。
 */

export interface ProjCtx {
  cx: number; cy: number;   // 灭点（视口中心，像素）
  mx: number; my: number;   // 归一化鼠标 [-0.5,0.5]（已缓动）
  focusZ: number;           // 对焦深度（= 固定水位）：该深度的球最清晰
  dof: boolean;             // 焦平面景深开关（关 → blurAmt=0 全清晰）
  perspective: boolean;     // 一点透视开关（关 → 尺寸=1、无聚散）
  parallax: boolean;        // 鼠标视差开关（关 → 不随鼠标位移）
}
export interface Projected { sx: number; sy: number; scale: number; blurAmt: number; }

const TILT_PX = 90;        // 鼠标视差最大像素位移（近球）
// 聚散随尺寸 1:1（spread = scale）→ 均匀透视缩放：球间距与球大小同比变化（绕灭点）。
// <1 会让"大小变得比间距快"→ 近球挤、远球疏（用户反馈的问题）；=1 则远不疏、近不挤，整体像真·拉近/推远。
const SPREAD_FRAC = 1.0;

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smooth01(v: number): number { const t = clamp01(v); return t * t * (3 - 2 * t); }

export function tiltCoef(z: number): number { return 0.15 + Math.pow(clamp01(z), 1.2) * 0.85; }
/** 有效深度 d∈[0,1] → 球尺寸倍率：水面(0.5)≈1×、最近(1.0)→1.5×、最远(0)→0.5×。线性，绕水面中性。
 *  「球浮动」= 层级波动：球的渲染深度 d 由 renderDepth(z, _waveZ) 给出（含波动偏移）→ 球随波动平滑变大/变小 + 透视位移。 */
function perspScale(d: number): number { return 0.5 + d * 1.0; }

/** 单球投影：sim 坐标(x,y) + 有效深度 d + 上下文 → 屏幕坐标 / 缩放 / 失焦度。三效各按 ctx 开关门控。 */
export function project(x: number, y: number, d: number, ctx: ProjCtx): Projected {
  const tc = tiltCoef(d);
  const px = x + (ctx.parallax ? ctx.mx * TILT_PX * tc : 0);
  const py = y + (ctx.parallax ? ctx.my * TILT_PX * tc : 0);
  const scale = ctx.perspective ? perspScale(d) : 1;                 // 透视关 → 尺寸=1（球用基础半径）
  const spread = ctx.perspective ? 1 + (scale - 1) * SPREAD_FRAC : 1; // 绕灭点聚散（比缩放温和）
  const sx = ctx.cx + (px - ctx.cx) * spread;
  const sy = ctx.cy + (py - ctx.cy) * spread;
  // 景深：仅**离远**(d<focusZ，更小更远)的球虚化；离近(d≥focusZ)保持清晰。景深关 → 全清晰
  const blurAmt = ctx.dof ? smooth01(Math.max(0, ctx.focusZ - d) * 1.5) : 0;
  return { sx, sy, scale, blurAmt };
}

/** 逆投影：屏幕落点(sx,sy) + 有效深度 d → sim 坐标(x,y)（拖球用）。与 project 的位移变换互逆（同样门控）。 */
export function unproject(sx: number, sy: number, d: number, ctx: ProjCtx): { x: number; y: number } {
  const tc = tiltCoef(d);
  const scale = ctx.perspective ? perspScale(d) : 1;
  const spread = ctx.perspective ? 1 + (scale - 1) * SPREAD_FRAC : 1;
  const px = ctx.cx + (sx - ctx.cx) / spread;
  const py = ctx.cy + (sy - ctx.cy) / spread;
  return {
    x: px - (ctx.parallax ? ctx.mx * TILT_PX * tc : 0),
    y: py - (ctx.parallax ? ctx.my * TILT_PX * tc : 0),
  };
}
