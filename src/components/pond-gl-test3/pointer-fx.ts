'use client';

import { useEffect } from 'react';
import { getRippleTuning } from './water/spike/ripple-tuning';

/**
 * /test3 — 指针交互单例：滚轮 → 球**集体深度偏移** shift（层模型）、鼠标 → 视差位移。
 *
 * 与 /test「滚轮=视角前进」不同：/test3 滚轮让所有音乐圆圈**集体在深度上位移**（靠近/变远），
 * 过程中穿过固定水面（层 50）产生出入水交互。层模型：
 *   base z∈[0,1] → 默认层 35-65（effDepth = 0.35 + z·0.30，绕水面 50）；
 *   滚轮叠 shift∈[-0.35,+0.35] → 球最近抵层 70-100（全部出水、近/大）、最远层 1-30（全部入水、远/小）。
 * 范式同 water-level（模块级 let + rAF 缓动 + 直读，不触发 React 重渲染）。读方每帧调 effDepth()/getPointerFx()。
 */

const SHIFT_MIN = -0.35, SHIFT_MAX = 0.35; // 集体深度偏移范围（默认 0 = 球 35-65 层）
const SHIFT_SENS = 0.0015;                 // 滚轮灵敏度（每 deltaY 单位的 shift 变化）
// 单次滚轮事件封顶 = 运动参数面板的 scrollStep（默认 0.05）→ 不论设备 deltaY 大小（含像素级/触控板惯性），
// 一格滚轮最多移 scrollStep 深度 → 球逐颗出入水（band 0.30 ÷ scrollStep ≈ 滚几次）。随时面板可调。
const D_LO = 0.35, D_SPAN = 0.30;          // base z∈[0,1] → 默认层 35-65（band 跨度 0.30 = 入水先后差）

let shiftTarget = 0, shift = 0;
let mxTarget = 0, myTarget = 0, mx = 0, my = 0;
let inside = false;

/** 相机三效开关（控制台按钮 → 页面 setCameraFx 写、ctx builder + project 读）。 */
export interface CameraFx { dof: boolean; perspective: boolean; parallax: boolean }
let cam: CameraFx = { dof: true, perspective: true, parallax: true };
export function getCameraFx(): CameraFx { return cam; }
export function setCameraFx(v: CameraFx): void { cam = v; }

/** 每帧读：已缓动的归一化鼠标位移（视差用） */
export function getPointerFx(): { mx: number; my: number } {
  return { mx, my };
}

/** base 深度 z∈[0,1] → 层模型有效深度：默认 0.35-0.65(层 35-65)，叠滚轮集体偏移 shift；clamp[0,1]=层 0-100。 */
export function effDepth(zBase: number): number {
  const d = D_LO + zBase * D_SPAN + shift;
  return d < 0 ? 0 : d > 1 ? 1 : d;
}

/** 渲染深度 = effDepth(zBase) + 球浮动「层级波动」偏移 waveZ（effDepth 域）。投影/没入判定用它（含滚轮 shift + 浮动）。 */
export function renderDepth(zBase: number, waveZ: number): number {
  const d = D_LO + zBase * D_SPAN + shift + waveZ;
  return d < 0 ? 0 : d > 1 ? 1 : d;
}

/** 滚轮极限趋近度 ∈[-1,1]：-1=滚到底(全没入端)、+1=滚到顶(全出水端)、0=中段。
 *  球浮动据此在极限处只收敛"会越过水面回到另一侧"的方向 → 保证"滚到底必沉 / 滚到顶都出水"，中段不受影响。 */
export function getScrollExtremity(): number {
  return shift / SHIFT_MAX; // shift 已缓动且 clamp 到 [SHIFT_MIN, SHIFT_MAX] → 归一到 [-1,1]
}

/** 滚轮是否正在进行（shift 尚未缓动贴齐目标）。球浮动据此暂停波相位 → 滚动时所有球随 shift 匀速变层、不被浮动扰动。 */
export function isScrolling(): boolean {
  return shift !== shiftTarget;
}

export function usePointerFx(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      mxTarget = e.clientX / window.innerWidth - 0.5;
      myTarget = e.clientY / window.innerHeight - 0.5;
      inside = true;
    };
    const onLeave = (e: PointerEvent) => { if (!e.relatedTarget) inside = false; };
    // 一点透视开时滚轮接管 → 集体深度偏移（上滚 deltaY<0 → shift 增 → 球升出水面、靠近、变大）
    const onWheel = (e: WheelEvent) => {
      if (!cam.perspective) return; // 透视关 → 滚轮回归页面正常滚动
      e.preventDefault();
      // 单次封顶（运动参数面板 scrollStep 可调）→ 大 deltaY 不再一步跨过整个 band，球逐颗入水
      const cap = getRippleTuning().scrollStep;
      const step = Math.max(-cap, Math.min(cap, e.deltaY * SHIFT_SENS));
      shiftTarget = Math.max(SHIFT_MIN, Math.min(SHIFT_MAX, shiftTarget - step));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onLeave, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    let raf = 0;
    const loop = () => {
      mx += ((inside ? mxTarget : 0) - mx) * 0.12;
      my += ((inside ? myTarget : 0) - my) * 0.12;
      shift += (shiftTarget - shift) * 0.12;
      if (Math.abs(shiftTarget - shift) < 0.0004) shift = shiftTarget; // 贴齐目标 → isScrolling() 能干净归 false
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
      window.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
    };
  }, [active]);
}
