'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Points,
  type ShaderMaterial,
} from 'three';
import { getRippleTuning, ZOOM_MIN } from '../water/spike/ripple-tuning';
import { getWaterLevel } from '../water/water-level';

/**
 * K8 — 水面漂浮微光层（夜塘冷调浮尘点阵）。
 *
 * 作为 R3F Points 挂进 PondGL 的 <Canvas> 根级 → 自动进 WaterDistort 的 realScene →
 * 被合成 pass 的折射/涟漪一起扭曲（正是"在水里被水扭"的效果）；waterFx 关时直接渲染也 OK。
 *
 * 两种行为（playbook K8）：
 *  ① **K6 缩放参照（第一要务）**：每帧绕画面中心（NDC 原点）按 zoom 放缩自身坐标 →
 *     升水位整片"光流"扩散变大、降则收拢变小 → 让 K6 缩放一眼可感。
 *     zoom 与合成 shader 的 uZoomAmount 同款公式（绕中心 0.5 = NDC 原点），两边一起缩。
 *  ② **轻柔游走（克制·辅）**：每点叠极小正弦漂移（motesDrift），缩放为主、漂移克制免糊掉缩放感。
 *
 * 坐标系：用裁剪空间（NDC，gl_Position=vec4(pos.xy,0,1)）—— 与 BaseTone/BgImage 同款全屏路子，
 * 不依赖相机（glSpheres 开/关都稳）；NDC 原点 = 画面中心 = K6 缩放中心。
 * 红线：只加水面装饰层，不碰球；透明度 <1、加色混合柔光，退让不抢球。
 *
 * 性能/eslint：粒子坐标每帧在**模块级 helper**（stepMotes）里命令式写 BufferAttribute，
 * 不触发 React re-render、不在组件体内改 hook 返回值（同 SphereInstances.writeFrame 范式）。
 */

// 粒子上限（motesCount 0–1 映射到 0..MAX）。300 颗冷白小点足够成"光流"、远低于性能阈值。
const MAX_MOTES = 300;
const MOTE_COLOR = new Color('#cce5ff'); // 冷白银蓝

interface MoteUniforms {
  uSize: { value: number };
  uOpacity: { value: number };
  uColor: { value: Color };
  [key: string]: { value: unknown };
}

// 顶点着色器：直接把 NDC 坐标当裁剪空间用（全屏、不经相机）；gl_PointSize = 屏幕像素（sizeAttenuation 关）。
const motesVertex = /* glsl */ `
  uniform float uSize;
  attribute float aSeed;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    gl_Position = vec4(position.xy, 0.0, 1.0);
    gl_PointSize = uSize;
  }
`;

// 片元：圆形柔边光点（中心亮→边缘 0），冷白；按点的 seed 微调亮度让点阵不呆板。
const motesFragment = /* glsl */ `
  precision mediump float;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vSeed;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    // 柔高斯衰减 → 无硬边（不 discard，保抗锯齿/柔光质感）
    float a = smoothstep(0.5, 0.0, r);
    a *= a;                                   // 收紧核心，光晕更柔
    float twinkle = 0.7 + 0.3 * vSeed;        // 逐点亮度微差（静态，避免抢眼闪烁）
    gl_FragColor = vec4(uColor, a * uOpacity * twinkle);
  }
`;

interface MoteState {
  base: Float32Array;   // 基础 NDC 坐标（x,y 交替；游走与缩放都基于它，避免漂移累积）
  seed: Float32Array;   // 逐点随机相位（驱动游走 + 亮度微差）
}

/** 初始化粒子：在 NDC[-1,1]² 内均匀撒点（略超界 ±1.1，缩放收拢时也不露空边）。 */
function makeMoteState(): MoteState {
  const base = new Float32Array(MAX_MOTES * 2);
  const seed = new Float32Array(MAX_MOTES);
  // 固定可复现的伪随机（不引库）：线性同余，初值任取 → 每次挂载分布一致、调密度不跳动
  let s = 1337;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < MAX_MOTES; i++) {
    base[i * 2] = (rnd() * 2 - 1) * 1.1;     // x ∈ [-1.1,1.1]
    base[i * 2 + 1] = (rnd() * 2 - 1) * 1.1; // y ∈ [-1.1,1.1]
    seed[i] = rnd();
  }
  return { base, seed };
}

/**
 * 每帧推进（模块级命令式，避 react-hooks/immutability）：
 * 对每个可见点 = 基础坐标 → 叠轻柔游走 → 绕中心按 zoom 缩放 → 写回 position attribute。
 * zoom：waterZoom 开时 = 1+(水位−0.5)·zoomAmount（同合成 shader），关时恒 1（现状）。
 */
function stepMotes(
  geom: BufferGeometry,
  st: MoteState,
  time: number,
  zoom: number,
  drift: number,
  count: number,
): void {
  const pos = geom.getAttribute('position') as BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < count; i++) {
    const bx = st.base[i * 2];
    const by = st.base[i * 2 + 1];
    const ph = st.seed[i] * 6.2831853; // 逐点相位
    // 轻柔游走：极小振幅（≤~0.03 NDC）正弦漂移，x/y 错频 → 不规则缓动；drift=0 时无漂移
    const dx = Math.sin(time * 0.21 + ph) * 0.03 * drift;
    const dy = Math.cos(time * 0.17 + ph * 1.3) * 0.03 * drift;
    // 绕画面中心（NDC 原点）缩放：先游走再缩放 → 整片随 zoom 扩散/收拢
    arr[i * 3] = (bx + dx) * zoom;
    arr[i * 3 + 1] = (by + dy) * zoom;
    arr[i * 3 + 2] = 0;
  }
  pos.needsUpdate = true;
  geom.setDrawRange(0, count);
}

export default function FloatingMotes({ waterZoom = false }: { waterZoom?: boolean }) {
  const pointsRef = useRef<Points>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const state = useMemo(() => makeMoteState(), []);

  // geometry：position(MAX×3) 每帧写、aSeed(MAX×1) 一次性 → 逐点亮度/相位
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_MOTES * 3), 3));
    g.setAttribute('aSeed', new BufferAttribute(state.seed, 1));
    return g;
  }, [state]);

  const uniforms = useMemo<MoteUniforms>(() => ({
    uSize: { value: 2 },
    uOpacity: { value: 0.6 },
    uColor: { value: MOTE_COLOR },
  }), []);

  useFrame((s) => {
    const pts = pointsRef.current;
    const mat = matRef.current;
    if (!pts || !mat) return;
    const t = getRippleTuning();
    // K8 第一要务：绕中心按 zoom 缩放，**与合成 shader 的 uZoomAmount 同款门控+公式** →
    // 当 K6 参照。waterZoom 开 → zoom=1+(水位−0.5)·zoomAmount（同 WaterDistort）；
    // 关 → zoom≡1（与水面"不缩放=现状"一致，微光也不缩，避免比水更早动 = 假参照）。
    const zoom = waterZoom && t.zoomAmount > 0
      ? Math.max(ZOOM_MIN, 1 + (getWaterLevel() - 0.5) * t.zoomAmount) // 同 shader/滴水的下限 → 大幅度也不翻转
      : 1;
    // 写 material 真身 uniforms（R3F 拷贝坑：改外部 uniforms 对象无效）
    mat.uniforms.uSize.value = t.motesSize;
    mat.uniforms.uOpacity.value = t.motesOpacity;
    const count = Math.max(0, Math.min(MAX_MOTES, Math.round(t.motesCount * MAX_MOTES)));
    stepMotes(pts.geometry as BufferGeometry, state, s.clock.getElapsedTime(), zoom, t.motesDrift, count);
  });

  return (
    // renderOrder 0（默认）：在 BaseTone(−1)/球之间的水面装饰层；进 realScene 被合成扭曲。
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={motesVertex}
        fragmentShader={motesFragment}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
