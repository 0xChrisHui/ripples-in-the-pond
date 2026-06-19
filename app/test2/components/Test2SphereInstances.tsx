'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  DoubleSide,
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  OrthographicCamera,
  ShaderMaterial,
} from 'three';
import { sphereVertexShader, sphereFragmentShader, HALO_R } from '@/src/components/pond-gl/spheres/sphere-shader';
import type { GlPhysNode } from '@/src/components/pond-gl/spheres/gl-sim-setup';
import { pushGlSpheresByWaves, type BgWave } from '@/src/components/pond-gl/spheres/gl-sim-waves';
import { stepSphereMotion } from '@/src/components/pond-gl/spheres/sphere-motion';
import type { GlSim } from '@/src/components/pond-gl/spheres/use-gl-sim';
// ↓↓ 仅这两处指向 /test2 专属 store（与 /test1 解耦的全部所在）；其余复用共享纯函数 ↓↓
import { getTuning, type SphereTuning } from './test2-sphere-tuning';
import { getSubmerge, getWaterLevel } from './test2-water-level';

/**
 * /test2 专属球渲染 —— 与 /test1 的 `pond-gl/spheres/SphereInstances.tsx` 逐字同构，
 * 唯一区别：调色读 `./test2-sphere-tuning`、没入读 `./test2-water-level`（独立 store）。
 * shader / sim 推进 / 涟漪推球全部复用共享纯函数（无单例耦合），故只换这两行 import 即彻底解耦（task 2）。
 */

const BODY_RATIO = 1 / HALO_R;
const tmpMatrix = new Matrix4();

interface InstanceBuf {
  aColor: Float32Array;
  aParams: Float32Array;
  baseColors: ReadonlyArray<readonly [number, number, number]>;
  hoverLerp: Float32Array;
  dimLerp: Float32Array;
}

interface SphereUniforms {
  uBrightness: { value: number };
  uContrast: { value: number };
  uSaturation: { value: number };
  [key: string]: { value: unknown };
}

function hexToSRGB(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const WHITE: readonly [number, number, number] = [1, 1, 1];

function applyTuningUniforms(mat: ShaderMaterial, t: SphereTuning): void {
  mat.uniforms.uBrightness.value = t.brightness;
  mat.uniforms.uContrast.value = t.contrast;
  mat.uniforms.uSaturation.value = t.saturation;
}

function configurePixelCamera(cam: OrthographicCamera, w: number, h: number): void {
  cam.left = 0; cam.right = w; cam.top = 0; cam.bottom = h;
  cam.near = -1000; cam.far = 1000;
  cam.position.set(0, 0, 10);
  cam.updateProjectionMatrix();
}

function writeFrame(
  mesh: InstancedMesh,
  nodes: GlPhysNode[],
  buf: InstanceBuf,
  wavesRef: React.RefObject<BgWave[]>,
  playingId: string | null,
  hoverId: string | null,
  tuning: SphereTuning,
  waterOn: boolean,
  motionOn: boolean,
): void {
  const now = performance.now();
  stepSphereMotion(nodes, now / 1000, getWaterLevel(), playingId, motionOn);
  wavesRef.current = wavesRef.current.filter((w) => now - w.spawnTime < w.duration);
  pushGlSpheresByWaves(nodes, wavesRef.current, playingId, now);

  const anyPlaying = playingId != null;
  const { aColor, aParams, baseColors, hoverLerp, dimLerp } = buf;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.x == null || n.y == null) continue;
    const isPlaying = n.id === playingId;
    const isHover = n.id === hoverId;

    hoverLerp[i] += ((isHover ? 1 : 0) - hoverLerp[i]) * 0.18;
    dimLerp[i] += ((anyPlaying && !isPlaying ? 0 : 1) - dimLerp[i]) * 0.12;

    const diameter = 2 * n.radius * HALO_R * (1 + hoverLerp[i] * 0.09);
    tmpMatrix.makeScale(diameter, diameter, 1);
    tmpMatrix.setPosition(n.x, n.y, 0);
    mesh.setMatrixAt(i, tmpMatrix);

    const c = isPlaying || (isHover && anyPlaying) ? WHITE : baseColors[i];
    aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2];

    let fill = 0.52 + n.importance * 0.36;
    if (isPlaying) fill = Math.min(0.95, fill + 0.2);
    const submerge = waterOn ? getSubmerge(n.displayZ ?? n.z) : 0;
    aParams[i * 4] = Math.min(1, fill * tuning.fill);
    aParams[i * 4 + 1] = (isHover ? 0.5 : 0.3) * tuning.halo;
    aParams[i * 4 + 2] = dimLerp[i] * (1 - submerge);
    aParams[i * 4 + 3] = BODY_RATIO;
  }

  mesh.instanceMatrix.needsUpdate = true;
  (mesh.geometry.getAttribute('aColor') as InstancedBufferAttribute).needsUpdate = true;
  (mesh.geometry.getAttribute('aParams') as InstancedBufferAttribute).needsUpdate = true;
}

export default function Test2SphereInstances(
  { glSim, waterOn, motionOn }: { glSim: GlSim; waterOn: boolean; motionOn: boolean },
) {
  const { nodes, sizeRef } = glSim;
  const count = nodes.length;
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const camera = useThree((s) => s.camera);
  const lastSize = useRef({ w: 0, h: 0 });

  const buf = useMemo<InstanceBuf>(() => ({
    aColor: new Float32Array(count * 3),
    aParams: new Float32Array(count * 4),
    baseColors: nodes.map((n) => hexToSRGB(n.color)),
    hoverLerp: new Float32Array(count),
    dimLerp: new Float32Array(count).fill(1),
  }), [nodes, count]);

  const uniforms = useMemo<SphereUniforms>(() => ({
    uBrightness: { value: 1 },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
  }), []);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat || count === 0) return;
    const sz = sizeRef.current;
    if (sz.w && sz.h && (sz.w !== lastSize.current.w || sz.h !== lastSize.current.h)) {
      configurePixelCamera(camera as OrthographicCamera, sz.w, sz.h);
      lastSize.current = { w: sz.w, h: sz.h };
    }
    const tuning = getTuning();
    applyTuningUniforms(mat, tuning);
    writeFrame(mesh, nodes, buf, glSim.wavesRef, glSim.playingIdRef.current, glSim.hoverIdRef.current, tuning, waterOn, motionOn);
  });

  if (count === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute attach="attributes-aColor" args={[buf.aColor, 3]} />
        <instancedBufferAttribute attach="attributes-aParams" args={[buf.aParams, 4]} />
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
