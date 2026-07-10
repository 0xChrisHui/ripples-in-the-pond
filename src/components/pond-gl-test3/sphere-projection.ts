'use client';

/**
 * /test3 — 球的「一点透视 + 鼠标视差 + 景深」统一投影。
 *
 * 正交像素相机无内建透视，故在**屏幕空间**按有效深度 d 伪造（d 由 pointer-fx.depthOf() 给出：
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

// L0b：视差/浮动去同步的每球字段（内联最小类型，不 import GlPhysNode 避免耦合；调用方传 GlPhysNode 结构兼容）。
interface ProjNode { _parGain?: number; _parAng?: number; }
interface FloatNode { _waveZ?: number; _shivX?: number; _shivY?: number; }

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smooth01(v: number): number { const t = clamp01(v); return t * t * (3 - 2 * t); }

export function tiltCoef(z: number): number { return 0.15 + Math.pow(clamp01(z), 1.2) * 0.85; }
/** 有效深度 d∈[0,1] → 球尺寸倍率：水面(0.5)≈1×、最近(1.0)→1.5×、最远(0)→0.5×。线性，绕水面中性。
 *  「球浮动」= 层级波动：球的渲染深度 d 由 renderDepth(z, _waveZ) 给出（含波动偏移）→ 球随波动平滑变大/变小 + 透视位移。 */
function perspScale(d: number): number { return 0.5 + d * 1.0; }

/** 单球投影：sim 坐标(x,y) + 有效深度 d + 上下文 → 屏幕坐标 / 缩放 / 失焦度。三效各按 ctx 开关门控。
 *  node 可选（L2-2 视差去同步：偏移向量按每球种子旋转 _parAng + 缩放 _parGain）；缺省 pa=0/pg=1 → 与原逐字一致。 */
export function project(x: number, y: number, d: number, ctx: ProjCtx, node?: ProjNode): Projected {
  const tc = tiltCoef(d);
  const pg = node?._parGain ?? 1;
  const pa = node?._parAng ?? 0;
  const ca = Math.cos(pa), sa = Math.sin(pa);
  const rmx = ctx.mx * ca - ctx.my * sa;
  const rmy = ctx.mx * sa + ctx.my * ca;
  const px = x + (ctx.parallax ? rmx * TILT_PX * tc * pg : 0);
  const py = y + (ctx.parallax ? rmy * TILT_PX * tc * pg : 0);
  const scale = ctx.perspective ? perspScale(d) : 1;                 // 透视关 → 尺寸=1（球用基础半径）
  const spread = ctx.perspective ? 1 + (scale - 1) * SPREAD_FRAC : 1; // 绕灭点聚散（比缩放温和）
  const sx = ctx.cx + (px - ctx.cx) * spread;
  const sy = ctx.cy + (py - ctx.cy) * spread;
  // 景深：仅**离远**(d<focusZ，更小更远)的球虚化；离近(d≥focusZ)保持清晰。景深关 → 全清晰
  const blurAmt = ctx.dof ? smooth01(Math.max(0, ctx.focusZ - d) * 1.5) : 0;
  return { sx, sy, scale, blurAmt };
}

// 球浮动（与深度解耦）：投影后再叠的「呼吸 + 径向轻浮」——不进 renderDepth（深度只随 base+滚轮 = 稳定），
// 改在屏幕空间对投影点做 放大(呼吸) + 绕灭点聚散(径向)。GL 球 / DOM 命中层(编号·角标) / 水面遮罩三处共用此函数
// → 浮动球与它的编号/角标/水效始终一致、不分离。wz = node._waveZ ∈ [−幅, +幅]。
export const FLOAT_SIZE = 0.35;   // 呼吸：wz=±0.6 → ±21% 大小
export const FLOAT_SPREAD = 0.28; // 径向轻浮：wz=±0.6 → ±0.17×到灭点距离（上浮往外=更近感、下沉往内）
export function applyFloat(p: Projected, node: FloatNode | null | undefined, cx: number, cy: number): Projected {
  const wz = node?._waveZ ?? 0;
  const shx = node?._shivX ?? 0; // L2-4 偶发颤动屏幕位移（缺省 0 → 与改前逐字一致）
  const shy = node?._shivY ?? 0;
  if (wz === 0 && shx === 0 && shy === 0) return p;
  const fl = 1 + wz * FLOAT_SPREAD;
  return {
    sx: cx + (p.sx - cx) * fl + shx,
    sy: cy + (p.sy - cy) * fl + shy,
    scale: p.scale * (1 + wz * FLOAT_SIZE),
    blurAmt: p.blurAmt,
  };
}

/** 逆投影：屏幕落点(sx,sy) + 有效深度 d → sim 坐标(x,y)（拖球用）。与 project 位移变换严格互逆
 *  （同 node 的视差旋转/增益项在此抵消 → 拖球命中在任意 parallaxDesync 参数下不偏移）。 */
export function unproject(sx: number, sy: number, d: number, ctx: ProjCtx, node?: ProjNode): { x: number; y: number } {
  const tc = tiltCoef(d);
  const pg = node?._parGain ?? 1;
  const pa = node?._parAng ?? 0;
  const ca = Math.cos(pa), sa = Math.sin(pa);
  const rmx = ctx.mx * ca - ctx.my * sa;
  const rmy = ctx.mx * sa + ctx.my * ca;
  const scale = ctx.perspective ? perspScale(d) : 1;
  const spread = ctx.perspective ? 1 + (scale - 1) * SPREAD_FRAC : 1;
  const px = ctx.cx + (sx - ctx.cx) / spread;
  const py = ctx.cy + (sy - ctx.cy) / spread;
  return {
    x: px - (ctx.parallax ? rmx * TILT_PX * tc * pg : 0),
    y: py - (ctx.parallax ? rmy * TILT_PX * tc * pg : 0),
  };
}
