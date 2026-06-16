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
import { sphereVertexShader, sphereFragmentShader, HALO_R } from './sphere-shader';
import type { GlPhysNode } from './gl-sim-setup';
import { pushGlSpheresByWaves, type BgWave } from './gl-sim-waves';
import { getTuning, type SphereTuning } from './sphere-tuning';
import { getSubmerge, getWaterLevel } from '../water/water-level';
import { stepSphereMotion } from './sphere-motion';
import type { GlSim } from './use-gl-sim';

// 球色：手动解析 hex → sRGB 0-1，**绕过 three 的 Color/ColorManagement**。
// 为什么不用 new Color('#hex')：R3F 初始化时强制把 ColorManagement.enabled 设回 true（覆盖模块级设置），
// 于是 Color 把 hex 转成 linear 存；而我们的自定义 shader 不经 three 的 colorspace_fragment，
// three 不会把输出再编码回 sRGB → "linear 值被当 sRGB 直接显示" → 球色暗掉近一半
// （用户实测 SVG #A04546 → GL #562222/#581B1F）。手动 sRGB 直通后：shader 输出 = 原始 sRGB 值，
// canvas 原样显示，半透明混合也在 sRGB 空间（与 SVG/CSS 一致）。
function hexToSRGB(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const WHITE: readonly [number, number, number] = [1, 1, 1];

/**
 * G4 — 35/36 球 InstancedMesh（一次 draw call）。
 *
 * 每帧从 d3 sim 读 node.x/y 写 instance 矩阵 + 颜色 + 参数；播放淡出/hover 放大/球色高亮都在此算。
 * 正交相机配成屏幕像素 1:1（world (x,y)∈[0,w]×[0,h]，y 向下）→ sim 坐标直接当世界坐标，零换算。
 * 命令式写入（mutate 相机 / GPU buffer / sim 节点）全部放在**模块级函数**里，避开 react-hooks
 * 的 immutability 规则（它只约束组件/hook 体内改 prop / hook 返回值）。
 */

const BODY_RATIO = 1 / HALO_R; // body 边界占 quad 半宽的比例（≈0.862）
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
  // 索引签名：让对象直接满足 R3F shaderMaterial 的 uniforms prop 类型（{ [k]: IUniform }）
  [key: string]: { value: unknown };
}

/**
 * 把调色 store 同步到 shader uniform。
 *
 * ★必须写 material 真身的 uniforms（matRef.current.uniforms.X.value）——R3F 把 uniforms prop
 * 拷贝进 material，改外部那个 useMemo 对象到不了 shader（血泪踩坑 #1，WaterSurface 同此修法）。
 * 之前球色/淡出/白球能动是因为它们走逐实例 attribute（aColor/aParams），不依赖 uniform 通道。
 * 模块级函数：命令式写 GPU uniform，避开 react-hooks/immutability。
 */
function applyTuningUniforms(mat: ShaderMaterial, t: SphereTuning): void {
  mat.uniforms.uBrightness.value = t.brightness;
  mat.uniforms.uContrast.value = t.contrast;
  mat.uniforms.uSaturation.value = t.saturation;
}

/** 正交相机像素对齐：top<bottom → y 向下，与 sim 坐标系一致 */
function configurePixelCamera(cam: OrthographicCamera, w: number, h: number): void {
  cam.left = 0; cam.right = w; cam.top = 0; cam.bottom = h;
  cam.near = -1000; cam.far = 1000;
  cam.position.set(0, 0, 10);
  cam.updateProjectionMatrix();
}

/** 每帧把 sim 状态写进 InstancedMesh（矩阵 + 颜色 + params + 涟漪推球 + 平滑 lerp） */
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
  // H5：单点推进浮沉 → 写 node.displayZ（WaterDistort/SphereOverlay 随后读它）
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

    // 平滑：hover 放大（≈SVG r 0.22s）+ 播放淡出（≈SVG opacity 0.5s），逐帧 lerp 近似
    hoverLerp[i] += ((isHover ? 1 : 0) - hoverLerp[i]) * 0.18;
    dimLerp[i] += ((anyPlaying && !isPlaying ? 0 : 1) - dimLerp[i]) * 0.12;

    const diameter = 2 * n.radius * HALO_R * (1 + hoverLerp[i] * 0.09);
    tmpMatrix.makeScale(diameter, diameter, 1);
    tmpMatrix.setPosition(n.x, n.y, 0);
    mesh.setMatrixAt(i, tmpMatrix);

    // 播放球 / hover 且有人在播 → 白；否则球色（复刻 SphereNode renderFill）
    const c = isPlaying || (isHover && anyPlaying) ? WHITE : baseColors[i];
    aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2];

    let fill = 0.52 + n.importance * 0.36;        // 复刻 baseOpacity
    if (isPlaying) fill = Math.min(0.95, fill + 0.2);
    // G6 没入淡出：水位升过球 → 球淡出，露出下方铺满全屏的水波（= 水波盖住球）。
    // 折叠进整体不透明度 dim，shader 端无需改动；水关时 submerge=0 不影响。H5：读动态深度 displayZ。
    const submerge = waterOn ? getSubmerge(n.displayZ ?? n.z) : 0;
    aParams[i * 4] = Math.min(1, fill * tuning.fill);          // 浓度（fillOpacity × 调参）
    aParams[i * 4 + 1] = (isHover ? 0.5 : 0.3) * tuning.halo;  // haloPeak（halo-strong/soft × 调参）
    aParams[i * 4 + 2] = dimLerp[i] * (1 - submerge);
    aParams[i * 4 + 3] = BODY_RATIO;
  }

  mesh.instanceMatrix.needsUpdate = true;
  (mesh.geometry.getAttribute('aColor') as InstancedBufferAttribute).needsUpdate = true;
  (mesh.geometry.getAttribute('aParams') as InstancedBufferAttribute).needsUpdate = true;
}

export default function SphereInstances(
  { glSim, waterOn, motionOn }: { glSim: GlSim; waterOn: boolean; motionOn: boolean },
) {
  const { nodes, sizeRef } = glSim;
  const count = nodes.length;
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<ShaderMaterial>(null); // 写 uniform 走真身（见 applySphereUniforms）
  const camera = useThree((s) => s.camera);
  const lastSize = useRef({ w: 0, h: 0 }); // J2：相机跟随 sizeRef 的上次值（变了才重配像素相机）

  // per-instance 缓冲（随 nodes 重建：切组时 count 变 → 整组重建）
  const buf = useMemo<InstanceBuf>(() => ({
    aColor: new Float32Array(count * 3),
    aParams: new Float32Array(count * 4),
    baseColors: nodes.map((n) => hexToSRGB(n.color)),
    hoverLerp: new Float32Array(count),
    dimLerp: new Float32Array(count).fill(1),
  }), [nodes, count]);

  // 调色 uniform（稳定对象，每帧从 store 同步到 .value）
  const uniforms = useMemo<SphereUniforms>(() => ({
    uBrightness: { value: 1 },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
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
