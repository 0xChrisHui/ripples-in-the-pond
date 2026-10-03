import type { IUniform, Vector4 } from 'three';
import type { ResidentEchoPose } from '@/src/types/echo-resident';

/** 普通球先写完遮罩，再追加同帧驻留pose；不产生假Track或第二份投影。 */
export function writeResidentWaterMask(uniforms: Record<string, IUniform>, pose: ResidentEchoPose): boolean {
  if (pose.effectivePresence <= 0 || pose.bodyRadiusPx <= 0) return false;
  const spheres = uniforms.uSpheres?.value as Vector4[] | undefined;
  const dim = uniforms.uVisualDim?.value as number[] | undefined;
  const count = uniforms.uSphereCount?.value as unknown;
  if (!spheres || !dim || typeof count !== 'number' || !Number.isInteger(count) || count < 0
    || count >= spheres.length || count >= dim.length) return false;
  spheres[count].set(pose.sx, pose.sy, pose.bodyRadiusPx * 1.15, pose.depth);
  dim[count] = pose.effectivePresence;
  uniforms.uSphereCount.value = count + 1;
  return true;
}
