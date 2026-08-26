'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, InstancedMesh, OrthographicCamera, ShaderMaterial } from 'three';
import { sphereVertexShader, sphereFragmentShader } from './sphere-shader';
import { getTuning, type SphereTuning } from './sphere-tuning';
import { getEffectiveWaterLevel } from '../water/water-level';
import { type ProjCtx } from '../sphere-projection';
import { getPointerFx, getCameraFx } from '../pointer-fx';
import { getLifeTuning } from '../life/life-tuning';
import { lifeEnv } from '../life/life-core';
import { prefersReducedMotion } from '../reduced-motion';
import { writeFrame, hexToSRGB, BODY_RATIO, type InstanceBuf } from './sphere-frame';
import type { LifeFlags } from '../gl-flags';
import type { GlSim } from './use-gl-sim';
import { BACKGROUND_LAYER, SPHERE_LAYER } from '../water/composite/render-passes';
import { sampleKeyFx } from '../key-fx/key-fx-state';

/**
 * G4 — 35/36 球 InstancedMesh（一次 draw call）。
 *
 * 每帧 CPU 逻辑（writeFrame + InstanceBuf + hexToSRGB）已拆到 ./sphere-frame（L0b）；本组件只剩组件壳：
 * per-instance 缓冲 + 调色 uniform + 相机跟随 sizeRef。正交相机配成屏幕像素 1:1（world (x,y)∈[0,w]×[0,h]）。
 */

interface SphereUniforms {
  uBrightness: { value: number };
  uContrast: { value: number };
  uSaturation: { value: number };
  uColorGrade: { value: number };
  // 索引签名：让对象直接满足 R3F shaderMaterial 的 uniforms prop 类型（{ [k]: IUniform }）
  [key: string]: { value: unknown };
}

/**
 * 把调色 store 同步到 shader uniform 真身（matRef.current.uniforms.X.value）——R3F 把 uniforms prop
 * 拷贝进 material，改外部 useMemo 对象到不了 shader（血泪踩坑 #1，WaterSurface 同此修法）。
 */
function applyTuningUniforms(mat: ShaderMaterial, t: SphereTuning, keyFxHalo: number, colorGrade: boolean): void {
  mat.uniforms.uBrightness.value = t.brightness + keyFxHalo * 0.12;
  mat.uniforms.uContrast.value = t.contrast;
  mat.uniforms.uSaturation.value = t.saturation;
  mat.uniforms.uColorGrade.value = colorGrade ? 1 : 0;
}

/** L3/L5 形态 uniform：边缘波、激励与光晕呼吸统一写 material 真身。 */
function applyLifeUniforms(mat: ShaderMaterial, life: LifeFlags, timeSec: number, keyFxHalo: number): void {
  const lt = getLifeTuning();
  const k1 = Math.round(lt.edgeWaveFreq);
  const w = prefersReducedMotion() ? 0 : lt.edgeWaveSpeed; // reduced-motion → 停转（形状保留）
  mat.uniforms.uEdgeAmp.value = Math.max(life.edgeWave ? lt.edgeWaveAmp : 0, keyFxHalo * 0.045);
  mat.uniforms.uEdgeK1.value = k1;
  mat.uniforms.uEdgeK2.value = k1 + 3; // 非倍数、不合拍
  mat.uniforms.uEdgeW1.value = w;
  mat.uniforms.uEdgeW2.value = w * 1.618;
  mat.uniforms.uEdgeSoft.value = life.edgeWave ? lt.edgeSoft : 0;
  mat.uniforms.uExciteGain.value = life.edgeExcite ? lt.exciteGain : 0;
  mat.uniforms.uHaloBreathAmp.value = Math.max(life.haloBreath && !prefersReducedMotion() ? lt.haloBreathAmp : 0, keyFxHalo * 0.16);
  mat.uniforms.uHaloBreathSpeed.value = lt.haloBreathSpeed;
  mat.uniforms.uLifeEnv.value = lifeEnv(timeSec);
  mat.uniforms.uTime.value = timeSec;
}

/** /test3：屏幕中心灭点（视口像素）→ project 用的灭点。sizeRef = 画布像素尺寸（与命中层同口径）。 */
function makeProjCtx(w: number, h: number): ProjCtx {
  const { mx, my } = getPointerFx();
  const c = getCameraFx();
  return { cx: w / 2, cy: h / 2, mx, my, focusZ: getEffectiveWaterLevel(), dof: c.dof, perspective: c.perspective, parallax: c.parallax };
}

/** 正交相机像素对齐：top<bottom → y 向下，与 sim 坐标系一致 */
function configurePixelCamera(cam: OrthographicCamera, w: number, h: number): void {
  cam.left = 0; cam.right = w; cam.top = 0; cam.bottom = h;
  cam.near = -1000; cam.far = 1000;
  cam.position.set(0, 0, 10);
  cam.updateProjectionMatrix();
}

export default function SphereInstances(
  { glSim, waterOn, motionOn, sphereDrift, separatePass = false, colorGrade = false, life }: { glSim: GlSim; waterOn: boolean; motionOn: boolean; sphereDrift: boolean; separatePass?: boolean; colorGrade?: boolean; life: LifeFlags },
) {
  const { nodes, sizeRef } = glSim;
  const count = nodes.length;
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<ShaderMaterial>(null); // 写 uniform 走真身（见 applyTuningUniforms）
  const camera = useThree((s) => s.camera);
  const lastSize = useRef({ w: 0, h: 0 }); // J2：相机跟随 sizeRef 的上次值（变了才重配像素相机）

  const bindMesh = useCallback((mesh: InstancedMesh | null) => {
    meshRef.current = mesh;
    if (mesh) mesh.layers.set(separatePass ? SPHERE_LAYER : BACKGROUND_LAYER);
  }, [separatePass]);

  // per-instance 缓冲（随 nodes 重建：切组时 count 变 → 整组重建）
  const buf = useMemo<InstanceBuf>(() => ({
    aColor: new Float32Array(count * 3),
    aParams: new Float32Array(count * 4),
    aSeed: new Float32Array(count * 2),
    aSubmerge: new Float32Array(count),
    aLifeDim: new Float32Array(count).fill(1),
    baseColors: nodes.map((n) => hexToSRGB(n.color)),
    hoverLerp: new Float32Array(count),
    dimLerp: new Float32Array(count).fill(1),
  }), [nodes, count]);

  // 调色 uniform（稳定对象，每帧从 store 同步到 .value）
  const uniforms = useMemo<SphereUniforms>(() => ({
    uBrightness: { value: 1 },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uColorGrade: { value: 0 },
    uBodyRatio: { value: BODY_RATIO }, // /test3：原 aParams.w 常量，腾出 .w 给逐球景深失焦度
    uEdgeAmp: { value: 0 },   // L3 能量球边缘（0 = 正圆现状）
    uEdgeK1: { value: 5 },
    uEdgeK2: { value: 8 },
    uEdgeW1: { value: 0 },
    uEdgeW2: { value: 0 },
    uEdgeSoft: { value: 0 },
    uExciteGain: { value: 0 },
    uHaloBreathAmp: { value: 0 },
    uHaloBreathSpeed: { value: 0.12 },
    uLifeEnv: { value: 1 },
    uTime: { value: 0 },
    uWaterPass: { value: 0 },
  }), []);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat || count === 0) return;
    // J2：相机跟随 sizeRef（resize/转屏后 use-gl-sim 更新 sizeRef → 这里重配像素相机 → 与 DOM 命中层对齐）
    const sz = sizeRef.current;
    if (sz.w && sz.h && (sz.w !== lastSize.current.w || sz.h !== lastSize.current.h)) {
      configurePixelCamera(camera as OrthographicCamera, sz.w, sz.h);
      lastSize.current = { w: sz.w, h: sz.h };
    }
    const tuning = getTuning();
    const keyFxHalo = sampleKeyFx(performance.now() / 1000).halo;
    applyTuningUniforms(mat, tuning, keyFxHalo, colorGrade);
    applyLifeUniforms(mat, life, performance.now() / 1000, keyFxHalo); // L3 边缘 + L5 光晕呼吸
    const proj = makeProjCtx(sz.w || 1, sz.h || 1);
    writeFrame(mesh, buf, {
      nodes, wavesRef: glSim.wavesRef, playingId: glSim.playingIdRef.current, hoverId: glSim.hoverIdRef.current,
      tuning, waterOn, motionOn, proj, drift: sphereDrift, life, waveSpeed: 0.2 * (sz.h || 900), waterComposite: separatePass, keyFxHalo,
    });
  });

  if (count === 0) return null;
  return (
    <instancedMesh ref={bindMesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute attach="attributes-aColor" args={[buf.aColor, 3]} />
        <instancedBufferAttribute attach="attributes-aParams" args={[buf.aParams, 4]} />
        <instancedBufferAttribute attach="attributes-aSeed" args={[buf.aSeed, 2]} />
        <instancedBufferAttribute attach="attributes-aSubmerge" args={[buf.aSubmerge, 1]} />
        <instancedBufferAttribute attach="attributes-aLifeDim" args={[buf.aLifeDim, 1]} />
      </planeGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={sphereVertexShader}
        fragmentShader={sphereFragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}
