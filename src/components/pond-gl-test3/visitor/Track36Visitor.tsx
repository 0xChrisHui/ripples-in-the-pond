'use client';

import { useCallback, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4,
  ShaderMaterial,
} from 'three';
import { getPointerFx, getCameraFx, depthOf, displayDepthOf } from '../pointer-fx';
import { project, type ProjCtx } from '../sphere-projection';
import { getEffectiveWaterLevel, getSubmerge } from '../water/water-level';
import { getPlaybackFocus } from '../focus/playback-focus';
import { SPHERE_LAYER } from '../water/composite/render-passes';
import { sphereFragmentShader, sphereVertexShader, HALO_R } from '../spheres/sphere-shader';
import { BODY_RATIO, hexToSRGB } from '../spheres/sphere-frame';
import { setTrack36VisualDim, type Track36VisitorState } from './track36-state';

/** #36 仍使用常规音乐圆 shader；这里只给单实例轨迹单独写矩阵和透明度。 */
export default function Track36Visitor({ visitor }: { visitor: RefObject<Track36VisitorState | null> }) {
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const paramRef = useRef<InstancedBufferAttribute>(null);
  const submergeRef = useRef<InstancedBufferAttribute>(null);
  const visibilityRef = useRef(1);
  const matrix = useMemo(() => new Matrix4(), []);
  const buffers = useMemo(() => ({
    color: new Float32Array(hexToSRGB('#d9e6df')),
    params: new Float32Array([0.88, 0.34, 0, 0]),
    seed: new Float32Array([2.4, 0]),
    submerge: new Float32Array([0]),
    life: new Float32Array([1]),
  }), []);
  const uniforms = useMemo(() => ({
    uBrightness: { value: 1 }, uContrast: { value: 1 }, uSaturation: { value: 1 },
    uColorGrade: { value: 0 }, uBodyRatio: { value: BODY_RATIO },
    uEdgeAmp: { value: 0 }, uEdgeK1: { value: 5 }, uEdgeK2: { value: 8 },
    uEdgeW1: { value: 0 }, uEdgeW2: { value: 0 }, uEdgeSoft: { value: 0 },
    uExciteGain: { value: 0 }, uHaloBreathAmp: { value: 0.07 },
    uHaloBreathSpeed: { value: 0.12 }, uLifeEnv: { value: 1 },
    uTime: { value: 0 }, uWaterPass: { value: 0 },
  }), []);
  const bindMesh = useCallback((mesh: InstancedMesh | null) => {
    meshRef.current = mesh;
    if (!mesh) return;
    mesh.layers.set(SPHERE_LAYER);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(() => {
    const state = visitor.current, mesh = meshRef.current, mat = matRef.current;
    if (!state || !mesh || !mat || !state.active) {
      if (mesh) mesh.visible = false;
      return;
    }
    const node = state.node;
    const { mx, my } = getPointerFx(); const camera = getCameraFx();
    const ctx: ProjCtx = {
      cx: innerWidth / 2, cy: innerHeight / 2, mx, my,
      focusZ: getEffectiveWaterLevel(), dof: camera.dof,
      perspective: camera.perspective, parallax: camera.parallax,
    };
    const pose = project(node.x ?? 0, node.y ?? 0, depthOf(node), ctx, node);
    const diameter = node.radius * 2 * HALO_R * pose.scale;
    const focus = getPlaybackFocus();
    const target = focus.active && focus.trackId !== node.id ? 0 : 1;
    visibilityRef.current += (target - visibilityRef.current) * 0.12;
    if (Math.abs(target - visibilityRef.current) < 0.006) visibilityRef.current = target;
    matrix.makeScale(diameter, diameter, 1).setPosition(pose.sx, pose.sy, 0);
    mesh.setMatrixAt(0, matrix); mesh.instanceMatrix.needsUpdate = true; mesh.visible = true;
    if (paramRef.current) {
      paramRef.current.setZ(0, visibilityRef.current);
      paramRef.current.needsUpdate = true;
    }
    if (submergeRef.current) {
      submergeRef.current.setX(0, getSubmerge(displayDepthOf(node)));
      submergeRef.current.needsUpdate = true;
    }
    mat.uniforms.uTime.value = performance.now() / 1000;
    setTrack36VisualDim(state, visibilityRef.current);
  });

  return (
    <instancedMesh ref={bindMesh} args={[undefined, undefined, 1]} frustumCulled={false} renderOrder={1}>
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute attach="attributes-aColor" args={[buffers.color, 3]} />
        <instancedBufferAttribute ref={paramRef} attach="attributes-aParams" args={[buffers.params, 4]} />
        <instancedBufferAttribute attach="attributes-aSeed" args={[buffers.seed, 2]} />
        <instancedBufferAttribute ref={submergeRef} attach="attributes-aSubmerge" args={[buffers.submerge, 1]} />
        <instancedBufferAttribute attach="attributes-aLifeDim" args={[buffers.life, 1]} />
      </planeGeometry>
      <shaderMaterial ref={matRef} vertexShader={sphereVertexShader} fragmentShader={sphereFragmentShader}
        uniforms={uniforms} transparent depthTest={false} depthWrite={false} side={DoubleSide} />
    </instancedMesh>
  );
}
