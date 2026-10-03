import { Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial } from 'three';
import type { ResidentEchoFrameInput, ResidentEchoPose } from '../../../../types/echo-resident';
import { getTuning } from '../../spheres/sphere-tuning';
import { resolveResidentScenePose } from './pose';
import { RESIDENT_ECHO_SURFACE as surface } from '../config';

export function residentUniforms() {
  const values: Record<string, number> = {
    uBrightness: 1, uContrast: 1, uSaturation: 1, uColorGrade: 0,
    uBodyRatio: 1 / 1.16, uEdgeAmp: 0, uEdgeK1: 5, uEdgeK2: 8,
    uEdgeW1: 0, uEdgeW2: 0, uEdgeSoft: 0, uExciteGain: 0,
    uHaloBreathAmp: 0, uHaloBreathSpeed: 0, uLifeEnv: 1, uTime: 0, uWaterPass: 0,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));
}
const matrix = new Matrix4();
/** 最终 alpha 只写 aParams.z；水上 pass 仍消费它，主体和光晕都能完全隐藏。 */
export function writeResidentSphere(mesh: InstancedMesh, material: ShaderMaterial, pose: ResidentEchoPose,
  input: ResidentEchoFrameInput, colorGrade: boolean, motionSeconds = 0): void {
  const scene = resolveResidentScenePose(pose, input), tuning = getTuning();
  mesh.visible = pose.effectivePresence > 0 && pose.bodyRadiusPx > 0;
  matrix.makeScale(pose.haloRadiusPx * 2, pose.haloRadiusPx * 2, 1);
  matrix.setPosition(pose.sx, pose.sy, pose.depth);
  mesh.setMatrixAt(0, matrix); mesh.instanceMatrix.needsUpdate = true;
  const params = mesh.geometry.getAttribute('aParams') as InstancedBufferAttribute;
  params.setXYZW(0, 0.8 * tuning.fill, 0.3 * tuning.halo, scene.shaderAlpha, scene.blurAmt); params.needsUpdate = true;
  const submerge = mesh.geometry.getAttribute('aSubmerge') as Float32BufferAttribute;
  submerge.setX(0, scene.submerge); submerge.needsUpdate = true;
  material.uniforms.uBodyRatio.value = pose.haloRadiusPx > 0 ? pose.bodyRadiusPx / pose.haloRadiusPx : 1 / 1.16;
  material.uniforms.uBrightness.value = tuning.brightness;
  material.uniforms.uContrast.value = tuning.contrast;
  material.uniforms.uSaturation.value = tuning.saturation;
  material.uniforms.uColorGrade.value = colorGrade ? 1 : 0;
  material.uniforms.uTime.value = motionSeconds;
  material.uniforms.uEdgeAmp.value = surface.edgeAmp;
  material.uniforms.uEdgeW1.value = surface.edgeSpeed;
  material.uniforms.uEdgeW2.value = surface.edgeSpeed * 1.618;
  material.uniforms.uEdgeSoft.value = surface.edgeSoft;
  material.uniforms.uHaloBreathAmp.value = input.reducedMotion ? 0 : surface.haloBreathAmp;
  material.uniforms.uHaloBreathSpeed.value = surface.haloBreathSpeed;
}
