'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, type InstancedMesh, type ShaderMaterial } from 'three';
import type { ResidentEchoFrameInput, ResidentEchoRuntime } from '../../../../types/echo-resident';
import { sphereFragmentShader, sphereVertexShader } from '../../spheres/sphere-shader';
import { BACKGROUND_LAYER, SPHERE_LAYER } from '../../water/composite/render-passes';
import { residentUniforms, writeResidentSphere } from './sphere-material';

type Props = {
  runtime: ResidentEchoRuntime; getFrameInput: () => ResidentEchoFrameInput;
  separatePass?: boolean; colorGrade?: boolean;
};
/** 在原 Canvas 内挂一枚 render-only 实例，-1 优先级确保水面与 DOM 读取当前同帧 pose。 */
export function EchoResidentSphere({ runtime, getFrameInput, separatePass = false, colorGrade = false }: Props) {
  const mesh = useRef<InstancedMesh>(null), material = useRef<ShaderMaterial>(null);
  const [buffers] = useState(() => ({
    color: new Float32Array([217 / 255, 230 / 255, 223 / 255]), params: new Float32Array([0.8, 0.3, 0, 0]),
    seed: new Float32Array([0, 0]), submerge: new Float32Array([0]), lifeDim: new Float32Array([1]),
  }));
  const [uniforms] = useState(residentUniforms);
  useFrame(() => {
    const input = getFrameInput();
    const snapshot = runtime.step(input);
    if (!mesh.current || !material.current) return;
    mesh.current.layers.set(separatePass ? SPHERE_LAYER : BACKGROUND_LAYER);
    writeResidentSphere(mesh.current, material.current, snapshot.pose, input, colorGrade, snapshot.motionSeconds);
  }, -1);
  return <instancedMesh ref={mesh} args={[undefined, undefined, 1]} frustumCulled={false}>
    <planeGeometry args={[1, 1]}>
      <instancedBufferAttribute attach="attributes-aColor" args={[buffers.color, 3]} />
      <instancedBufferAttribute attach="attributes-aParams" args={[buffers.params, 4]} />
      <instancedBufferAttribute attach="attributes-aSeed" args={[buffers.seed, 2]} />
      <instancedBufferAttribute attach="attributes-aSubmerge" args={[buffers.submerge, 1]} />
      <instancedBufferAttribute attach="attributes-aLifeDim" args={[buffers.lifeDim, 1]} />
    </planeGeometry>
    <shaderMaterial ref={material} vertexShader={sphereVertexShader} fragmentShader={sphereFragmentShader}
      uniforms={uniforms} transparent depthTest={false} depthWrite={false} side={DoubleSide} />
  </instancedMesh>;
}
