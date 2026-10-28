/**
 * 气泡所在背景层永远画在球后面，所以生成与每帧都要知道"可见球"在哪。
 * 位置取与 SphereInstances.writeFrame 同一条投影链：applyFloat(project(...))，半径取保守值。
 */
import type { GlSim } from '../../spheres/use-gl-sim';
import { HALO_R } from '../../spheres/sphere-shader';
import { project, applyFloat, type ProjCtx } from '../../sphere-projection';
import { depthOf, getCameraFx, getPointerFx } from '../../pointer-fx';
import { getEffectiveWaterLevel } from '../../water/water-level';

export interface Disc { x: number; y: number; r: number }

const HOVER_GROW = 1.1;   // 悬停放大上限（writeFrame 为 1+0.09）
const SAFETY = 1.2;       // playbook Step 2：投影半径 ×1.2
const REFRACT_PX = 0.03;  // 折射位移上限约 UV ±0.025，取 0.03×短边做余量
const HIDDEN_PRESENCE = 0.05;

/** 把当前可见球写进 out（复用数组，返回个数）；#36 按 node.echo 的隐现度跳过，不按下标。 */
export function collectDiscs(glSim: GlSim | undefined, w: number, h: number, out: Disc[]): number {
  if (!glSim) return 0;
  const { mx, my } = getPointerFx();
  const cam = getCameraFx();
  const proj: ProjCtx = { cx: w / 2, cy: h / 2, mx, my, focusZ: getEffectiveWaterLevel(), dof: cam.dof, perspective: cam.perspective, parallax: cam.parallax };
  const margin = REFRACT_PX * Math.min(w, h);
  let count = 0;
  for (const n of glSim.nodes) {
    if (n.x == null || n.y == null) continue;
    if (n.echo != null && (n._presence ?? 1) < HIDDEN_PRESENCE) continue;
    const p = applyFloat(project(n.x, n.y, depthOf(n), proj, n), n, proj.cx, proj.cy);
    const r = n.radius * HALO_R * p.scale * HOVER_GROW * SAFETY + margin;
    const slot = out[count] ?? (out[count] = { x: 0, y: 0, r: 0 });
    slot.x = p.sx; slot.y = p.sy; slot.r = r;
    count++;
  }
  return count;
}
