'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, InstancedMesh, Matrix4, type ShaderMaterial } from 'three';
import { getRippleTuning } from '../water/spike/ripple-tuning';
import { getWaterLevel } from '../water/water-level';

/**
 * K9 — 水面水生植物层（俯视睡莲叶圆片 + 边缘芦苇丛，夜塘墨绿冷调）。
 *
 * R3F InstancedMesh 挂 PondGL <Canvas> 根级 → 进 WaterDistort realScene → 被合成折射/涟漪轻扭。
 * 同一 mesh 一次 draw call，aKind 区分：睡莲叶（0，中部柔边圆片，比 K8 更"有形"的强参照）/
 * 芦苇丛（1，左/右/下三边细暗竖条，暗示岸=框构图+纵深）。
 *
 * 两行为（与 K8 同框架但更沉静）：① K6 缩放参照（第一要务）—— 绕 NDC 中心按 zoom 放缩位置+大小，
 * 门控/公式同合成 uZoomAmount（waterZoom 开=1+(水位−0.5)·zoomAmount，关≡1=现状）；
 * ② 涟漪轻晃（克制·辅）—— 极小正弦摇曳（plantsSway），比 K8 更小几乎静止只微摇。
 *
 * 坐标系：NDC 裁剪空间（同 BaseTone/FloatingMotes，不经相机 → glSpheres 开关都稳；NDC 原点=缩放中心）。
 * 宽屏会把圆片横拉椭圆 → 实例矩阵 x 乘 1/aspect 还圆。红线：只加水面装饰层、不碰球；半透墨绿暗调、
 * 稀疏 + 边缘 reed 退让不挡球。eslint：实例矩阵每帧在模块级 helper（stepPlants）命令式写（同 writeFrame 范式）。
 */

// 实例上限（plantsCount 0–1 映射到可见睡莲数；芦苇为固定边缘簇，恒显）。
const MAX_LILY = 90;   // 睡莲叶上限（稀疏留白；0.3·90≈27 片足够成"浮叶"而不挡球）
const MAX_REED = 30;   // 芦苇上限（三边框，固定显示不随 plantsCount 变 → 边界感稳定）
const MAX_PLANTS = MAX_LILY + MAX_REED;

const TWO_PI = 6.2831853;

interface PlantUniforms {
  uOpacity: { value: number };
  [key: string]: { value: unknown };
}

// 顶点：实例矩阵已含 NDC 位姿/缩放/aspect 校正 → 直接当裁剪空间（不经相机）。传 aKind/aSeed 给片元。
const plantsVertex = /* glsl */ `
  attribute float aKind;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vKind;
  varying float vSeed;
  void main() {
    vUv = uv;
    vKind = aKind;
    vSeed = aSeed;
    gl_Position = instanceMatrix * vec4(position.xy, 0.0, 1.0);
  }
`;

// 片元：睡莲=柔边圆盘（中心略亮墨绿+窄缺口暗示叶裂）；芦苇=竖向暗条（下实上虚）。全程墨绿冷暗半透不抢球。
const plantsFragment = /* glsl */ `
  precision mediump float;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vKind;
  varying float vSeed;

  void main() {
    if (vKind < 0.5) {
      // 睡莲叶：quad 中心为圆心的柔边圆盘（不 discard，保抗锯齿）
      vec2 d = vUv - vec2(0.5);
      float r = length(d) * 2.0;
      float disk = smoothstep(1.0, 0.72, r);
      // 一道窄径向缺口（叶裂暗示）
      float ang = atan(d.y, d.x);
      float notch = smoothstep(0.16, 0.30, abs(sin((ang - vSeed * 6.2831853) * 0.5)));
      disk *= mix(0.82, 1.0, notch);
      // 墨绿冷调：中心略亮、边缘更暗（俯视体积感）；提亮到暗塘上可辨，仍冷暗不抢球
      vec3 col = mix(vec3(0.075, 0.22, 0.145), vec3(0.16, 0.36, 0.25), smoothstep(1.0, 0.2, r));
      col *= 0.85 + 0.25 * vSeed;
      gl_FragColor = vec4(col, disk * uOpacity);
    } else {
      // 芦苇丛：竖向暗条，下实上虚（贴边框构图，极暗）
      float a = smoothstep(0.5, 0.18, abs(vUv.x - 0.5)) * smoothstep(1.0, 0.15, vUv.y);
      vec3 reed = vec3(0.06, 0.16, 0.105) * (0.8 + 0.4 * vSeed);
      gl_FragColor = vec4(reed, a * uOpacity * 0.85);
    }
  }
`;

// 逐株基础位姿（缩放/摇曳都基于 base，避免累积漂移）；kind 0=睡莲/1=芦苇；aspectW=x 额外宽度系数（芦苇细）
interface PlantState {
  bx: Float32Array; by: Float32Array; rot: Float32Array; size: Float32Array;
  kind: Float32Array; seed: Float32Array; aspectW: Float32Array;
}

/** 初始化：睡莲散在中部留白、避开正中球密集区偏弱；芦苇贴左/右/下三边成框。固定伪随机可复现。 */
function makePlantState(): PlantState {
  const bx = new Float32Array(MAX_PLANTS);
  const by = new Float32Array(MAX_PLANTS);
  const rot = new Float32Array(MAX_PLANTS);
  const size = new Float32Array(MAX_PLANTS);
  const kind = new Float32Array(MAX_PLANTS);
  const seed = new Float32Array(MAX_PLANTS);
  const aspectW = new Float32Array(MAX_PLANTS);
  let s = 90210;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  // 睡莲叶：撒在 [-1,1]²，逐叶随机大小 0.6×–1.4×、随机旋转
  for (let i = 0; i < MAX_LILY; i++) {
    bx[i] = (rnd() * 2 - 1) * 1.05;
    by[i] = (rnd() * 2 - 1) * 1.05;
    rot[i] = rnd() * TWO_PI;
    size[i] = 0.6 + rnd() * 0.8;
    kind[i] = 0;
    seed[i] = rnd();
    aspectW[i] = 1;
  }
  // 芦苇丛：贴三边（左缘/右缘/底缘），细长竖条暗示岸；顶端略出界、根部贴边外
  for (let j = 0; j < MAX_REED; j++) {
    const i = MAX_LILY + j;
    const side = j % 3; // 0=左 1=右 2=下
    if (side === 0) { bx[i] = -1.02 - rnd() * 0.06; by[i] = (rnd() * 2 - 1) * 1.05; }
    else if (side === 1) { bx[i] = 1.02 + rnd() * 0.06; by[i] = (rnd() * 2 - 1) * 1.05; }
    else { bx[i] = (rnd() * 2 - 1) * 1.05; by[i] = -1.04 - rnd() * 0.06; }
    rot[i] = (rnd() - 0.5) * 0.5; // 近竖直，微随机倾斜
    size[i] = 1.6 + rnd() * 1.4;  // 芦苇更高（竖向拉长在矩阵里用 aspectW 反向压窄）
    kind[i] = 1;
    seed[i] = rnd();
    aspectW[i] = 0.16 + rnd() * 0.08; // 细条（x 远窄于 y）
  }
  return { bx, by, rot, size, kind, seed, aspectW };
}

// 每帧写实例矩阵（模块级命令式，避 react-hooks/immutability）：每株 = 基础位姿 → 叠涟漪轻晃 →
// 绕 NDC 中心按 zoom 缩放 → 组装 NDC scale/rotate/translate 矩阵（含 aspect 校正）。睡莲超 count 缩到 0；芦苇恒显。
function stepPlants(
  mesh: InstancedMesh,
  st: PlantState,
  m: Matrix4,
  time: number,
  zoom: number,
  baseSize: number,
  sway: number,
  aspect: number,
  lilyCount: number,
): void {
  const invA = 1 / Math.max(0.0001, aspect); // x 方向压缩系数（还圆：宽屏 aspect>1 → x 乘 1/aspect）
  for (let i = 0; i < MAX_PLANTS; i++) {
    const isLily = st.kind[i] < 0.5;
    // 睡莲超出 count → 缩到 0 隐藏（不挪 base，调密度时其余株不跳动）
    const hidden = isLily && i >= lilyCount;
    const ph = st.seed[i] * TWO_PI;
    // 涟漪轻晃：极小位移 + 旋转摇曳（克制——比 K8 更小、几乎静止只微摇）
    const swayAmp = (isLily ? 0.012 : 0.006) * sway;
    const dx = Math.sin(time * 0.16 + ph) * swayAmp;
    const dy = Math.cos(time * 0.13 + ph * 1.3) * swayAmp;
    const dRot = Math.sin(time * 0.11 + ph) * 0.08 * sway;
    // 绕画面中心（NDC 原点）按 zoom 缩放位置（同 FloatingMotes/合成 uZoomAmount）
    const x = (st.bx[i] + dx) * zoom;
    const y = (st.by[i] + dy) * zoom;
    // 半径：基准 plantsSize × 逐株倍率 × zoom（大小也随缩放，强参照）
    const r = hidden ? 0 : baseSize * st.size[i] * zoom;
    const rot = st.rot[i] + dRot;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    // 组装 NDC 矩阵：scale(rx,ry) → rotate(z) → translate(x,y)；rx 含 aspect 校正与逐株宽度系数
    const rx = r * st.aspectW[i] * invA;
    const ry = r;
    // 列主序写 4×4（旋转作用在已缩放的轴上）
    m.set(
      cos * rx, -sin * ry, 0, x,
      sin * rx, cos * ry, 0, y,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export default function WaterPlants({ waterZoom = false }: { waterZoom?: boolean }) {
  const meshRef = useRef<InstancedMesh>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const size = useThree((s) => s.size);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const state = useMemo(() => makePlantState(), []);
  const m = useMemo(() => new Matrix4(), []);

  const uniforms = useMemo<PlantUniforms>(() => ({
    uOpacity: { value: 0.5 },
  }), []);

  useFrame((s) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const t = getRippleTuning();
    // K6 参照：waterZoom 开 → zoom=1+(水位−0.5)·zoomAmount（同 WaterDistort/FloatingMotes）；关 → ≡1（现状）
    const zoom = waterZoom && t.zoomAmount > 0
      ? 1 + (getWaterLevel() - 0.5) * t.zoomAmount
      : 1;
    mat.uniforms.uOpacity.value = t.plantsOpacity; // R3F 拷贝坑：写 material 真身
    const lilyCount = Math.max(0, Math.min(MAX_LILY, Math.round(t.plantsCount * MAX_LILY)));
    stepPlants(mesh, state, m, s.clock.getElapsedTime(), zoom, t.plantsSize, t.plantsSway, aspect, lilyCount);
  });

  return (
    // renderOrder 0（默认）：BaseTone(−1) 之上、球之下的水面装饰层；进 realScene 被合成扭曲。
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PLANTS]} frustumCulled={false}>
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute attach="attributes-aKind" args={[state.kind, 1]} />
        <instancedBufferAttribute attach="attributes-aSeed" args={[state.seed, 1]} />
      </planeGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={plantsVertex}
        fragmentShader={plantsFragment}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}
