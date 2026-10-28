/**
 * 第36特殊圆 — 默认态变淡（P20 Step 1，艺术家意见：纯白在暗塘里太刺眼）。
 *
 * 只认 node.echo；只在"默认态"（没被播放、没因别人在播而高亮）生效，播放 / 日食路径把因子平滑拉回 0。
 * 两个量：alpha 乘到 aParams.z（playDim）——水下 pass 与水上 pass 的主体覆盖下限都读它，所以两个水 pass 同时变淡；
 * light 乘到球色（白 → 浅灰，D1 取 (a) 降亮度，不引入色相）。
 */
import type { GlPhysNode } from '../spheres/simulation/nodes';

export const CALM_ALPHA = 0.85; // 默认态最终主体覆盖率
export const CALM_LIGHT = 0.88; // 默认态球色亮度
const FOLLOW = 0.12;            // 与 dimLerp 同节奏的逐帧趋近

export interface CalmFactor { alpha: number; light: number }
const NEUTRAL: CalmFactor = { alpha: 1, light: 1 };
const out: CalmFactor = { alpha: 1, light: 1 };

/** 非第36圆返回常量 NEUTRAL（调用方只读，不要改）；第36圆推进一帧后返回共享的 out。 */
export function stepSpecial36Calm(n: GlPhysNode, active: boolean): CalmFactor {
  if (n.echo == null) return NEUTRAL;
  const cur = n._calm ?? 0;
  const next = cur + ((active ? 1 : 0) - cur) * FOLLOW;
  n._calm = next < 0.001 ? 0 : next;
  out.alpha = 1 - (1 - CALM_ALPHA) * n._calm;
  out.light = 1 - (1 - CALM_LIGHT) * n._calm;
  return out;
}
