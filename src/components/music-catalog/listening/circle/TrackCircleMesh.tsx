'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { Mesh, ShaderMaterial } from 'three';
import { HALO_R, sphereFragmentShader } from '../../../pond-gl-test3/spheres/sphere-shader';
import { getLifeTuning } from '../../../pond-gl-test3/life/life-tuning';
import { lifeEnv } from '../../../pond-gl-test3/life/life-core';
import { getTuning } from '../../../pond-gl-test3/spheres/sphere-tuning';
import type { CircleFrame } from './circle-state';
import { circleVertexShader } from './circle-shader';

const CIRCLE_LAYER = 2;

/** 复用首页片元材质；局部前景在水面合成后绘制，始终借用同一Canvas。 */
export default function TrackCircleMesh({ frame, onReady }: {
  frame: RefObject<CircleFrame>; onReady: (ready: boolean) => void;
}) {
  const mesh = useRef<Mesh>(null); const material = useRef<ShaderMaterial>(null);
  const drawn = useRef(false);
  useEffect(() => () => { drawn.current = false; onReady(false); }, [onReady]);
  const { gl, scene, camera } = useThree();
  const uniforms = useMemo(() => {
    return {
      uCircleCenter: { value: [0, 0] }, uCircleScale: { value: [0, 0] },
      uCircleColor: { value: [1, 1, 1] }, uCircleVisible: { value: 0 },
      uCircleParams: { value: [1, .36] }, uCircleSeed: { value: 0 },
      uBrightness: { value: 1.4 }, uContrast: { value: 1 }, uSaturation: { value: 1 }, uColorGrade: { value: 1 },
      uBodyRatio: { value: 1 / HALO_R }, uEdgeAmp: { value: .035 }, uEdgeK1: { value: 3 }, uEdgeK2: { value: 6 },
      uEdgeW1: { value: .4 }, uEdgeW2: { value: .647 }, uEdgeSoft: { value: .008 }, uExciteGain: { value: 0 },
      uHaloBreathAmp: { value: .22 }, uHaloBreathSpeed: { value: .18 }, uLifeEnv: { value: 1 },
      uTime: { value: 0 }, uWaterPass: { value: 0 },
    };
  }, []);
  useFrame(() => {
    const mat = material.current; const node = mesh.current; if (!mat || !node) return;
    node.layers.set(CIRCLE_LAYER);
    const pose = frame.current; node.visible = pose.visible;
    const t = getTuning(); const life = getLifeTuning(); const u = mat.uniforms;
    u.uCircleCenter.value = [pose.x / pose.width * 2 - 1, 1 - pose.y / pose.height * 2];
    u.uCircleScale.value = [pose.radius * HALO_R * 2 / pose.width, pose.radius * HALO_R * 2 / pose.height];
    u.uCircleVisible.value = pose.visible ? (1 - pose.mix) * pose.presence : 0;
    u.uCircleColor.value = pose.color;
    u.uCircleParams.value = [Math.min(1, (.52 + pose.importance * .36) * t.fill),
      (.3 + pose.hover * .2) * t.halo];
    u.uCircleSeed.value = pose.seed;
    u.uTime.value = pose.time;
    u.uBrightness.value = t.brightness; u.uContrast.value = t.contrast; u.uSaturation.value = t.saturation;
    u.uEdgeAmp.value = life.edgeWaveAmp;
    u.uEdgeK1.value = Math.round(life.edgeWaveFreq); u.uEdgeK2.value = Math.round(life.edgeWaveFreq) + 3;
    u.uEdgeSoft.value = life.edgeSoft;
    u.uEdgeW1.value = pose.reduced ? 0 : life.edgeWaveSpeed;
    u.uEdgeW2.value = pose.reduced ? 0 : life.edgeWaveSpeed * 1.618;
    u.uHaloBreathAmp.value = pose.reduced ? 0 : life.haloBreathAmp;
    u.uHaloBreathSpeed.value = life.haloBreathSpeed;
    u.uLifeEnv.value = lifeEnv(pose.time);
  });
  useFrame(() => {
    if (!frame.current.visible || !material.current || !mesh.current) return;
    const mask = camera.layers.mask; const autoClear = gl.autoClear; const target = gl.getRenderTarget();
    try {
      gl.setRenderTarget(null); gl.autoClear = false; camera.layers.set(CIRCLE_LAYER);
      gl.render(scene, camera);
      if (!drawn.current) { drawn.current = true; onReady(true); }
    } finally { camera.layers.mask = mask; gl.autoClear = autoClear; gl.setRenderTarget(target); }
  }, 2);
  return <mesh ref={mesh} frustumCulled={false}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial ref={material} vertexShader={circleVertexShader} fragmentShader={sphereFragmentShader}
      uniforms={uniforms} transparent depthWrite={false} depthTest={false} toneMapped={false} />
  </mesh>;
}
