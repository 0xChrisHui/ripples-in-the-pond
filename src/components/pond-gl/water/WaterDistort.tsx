'use client';

import { useFBO } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Scene,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  OrthographicCamera,
  Vector2,
  Vector4,
  HalfFloatType,
  RGBAFormat,
  LinearFilter,
  ClampToEdgeWrapping,
  type Camera,
  type IUniform,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { quadVert, simFrag, MAX_DROPS } from './spike/ripple-spike-shaders';
import { getRippleTuning, type RippleTuning } from './spike/ripple-tuning';
import { compositeMaskFrag, MAX_SPHERES } from './water-distort-shaders';
import { getWaterLevel } from './water-level';
import {
  collectObjectDrops, collectAmbientDrop, writeDrops, resetRippleFeed, type Drop,
} from './ripple-feed';
import type { GlSim } from '../spheres/use-gl-sim';
import type { GlPhysNode } from '../spheres/gl-sim-setup';

/**
 * H2/H3/H4 — 全屏动态扭曲水面（真场景 + 水位深度遮罩 + 涟漪交互全集）。
 *
 * 渲真实 GL 场景（基调/背景/球）进内容 FBO → ping-pong 高度场 → 合成折射 pass 全屏扭（接管渲染循环、返回 null）。
 * H3：把球的坐标/半径/深度当 uniform 数组传进合成 shader，逐像素算"露出水面程度"——
 * 露出水面(z>L)的球不扭(清晰)、水下的扭。（不渲离屏 z 图：换材质在 R3F+InstancedMesh 上不稳。）
 * H4：一帧汇集多滴喂高度场——指针/wave（pending）+ 对象涟漪（拖球尾迹/穿越溅起/>6 合并，见 ripple-feed）
 * + 常驻微波，写进 sim 的 uDrops 数组。命中层是 canvas 之上的 DOM、不进 shader → 点击不受扭曲影响。
 * 注：sim/quadVert/参数 store 暂复用 water/spike/（H 线收尾、spike 退役时挪进 water/ 正式化）。
 */

// 高度场分辨率：纵向固定，横向按屏幕宽高比 → 格子在屏幕上是「正方形」→ 涟漪传播天然正圆
// （取代旧的方形 256² + 各向异性补偿；载入时按当前窗口定，重载即重适配，clamp 防极端比例）
const RES_Y = 256;
const RES_X = Math.min(1024, Math.max(64, Math.round(RES_Y * (typeof window === 'undefined' ? 1 : window.innerWidth / Math.max(1, window.innerHeight)))));
// H6 色斑修复：高度场用 Linear（双线性）采样，让合成 pass 重建梯度时平滑、消块状色斑 +
// 缓解 half-float 梯度量化。⚠ sim 只在「texel 中心」采 uPrev（vUv ± uDelta），Linear 在中心点
// 等价 Nearest → 波动方程逐字不变（H1 调研报告"数据纹理 Nearest"针对非中心采样，此处不踩）。
// 不升 512²：分辨率会改波速/阻尼的屏幕观感、推翻已调好的手感；色斑根因是采样而非分辨率。
const SIM_OPTS = {
  type: HalfFloatType,
  format: RGBAFormat,
  minFilter: LinearFilter,
  magFilter: LinearFilter,
  wrapS: ClampToEdgeWrapping,
  wrapT: ClampToEdgeWrapping,
  depthBuffer: false,
  stencilBuffer: false,
};

interface QuadScene {
  scene: Scene;
  mat: ShaderMaterial;
}
function makeQuadScene(frag: string, uniforms?: Record<string, IUniform>): QuadScene {
  const mat = new ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms });
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(2, 2), mat));
  return { scene, mat };
}

interface PingPong {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
}

const EMPTY_NODES: GlPhysNode[] = []; // glSim 未就绪时占位（无球 → 全屏扭）

function applyTuning(sim: QuadScene, composite: QuadScene, t: RippleTuning, debug: boolean, aspect: number): void {
  sim.mat.uniforms.uDamping.value = t.damping; // 滴水半径改逐滴写（uDrops[i].z）
  sim.mat.uniforms.uAspect.value = aspect;     // K1：高度场方形被拉满宽屏 → 按宽高比校正滴水为正圆
  composite.mat.uniforms.uPerturb.value = t.refract;
  composite.mat.uniforms.uSpec.value = t.specular;
  composite.mat.uniforms.uDebug.value = debug ? 1 : 0;
}

/** 把球数据写进 uniform 数组（位置/半径/深度），供合成 shader 逐像素算水位遮罩。模块级避 immutability。 */
function applySpheres(composite: QuadScene, nodes: GlPhysNode[], w: number, h: number, waterLevel: number): void {
  const arr = composite.mat.uniforms.uSpheres.value as Vector4[];
  const n = Math.min(nodes.length, MAX_SPHERES);
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    // H5：用动态深度 displayZ（球浮沉后的实时深度），未启用浮沉时回退静态 z
    arr[i].set(node.x ?? 0, node.y ?? 0, node.radius * 1.15, node.displayZ ?? node.z); // 半径放大覆盖光晕
  }
  composite.mat.uniforms.uSphereCount.value = n;
  (composite.mat.uniforms.uViewport.value as Vector2).set(w || 1, h || 1);
  composite.mat.uniforms.uWaterLevel.value = waterLevel;
}

/** 一帧：真场景→内容 FBO，ping-pong sim 推进（滴水已在 useFrame 写好 uDrops），合成折射(带遮罩)→屏幕。 */
function tick(
  gl: WebGLRenderer,
  realScene: Scene,
  realCam: Camera,
  content: WebGLRenderTarget,
  sim: QuadScene,
  bufs: { current: PingPong },
  composite: QuadScene,
  quadCam: OrthographicCamera,
): void {
  gl.setRenderTarget(content);
  gl.render(realScene, realCam);
  const { read, write } = bufs.current;
  sim.mat.uniforms.uPrev.value = read.texture;
  gl.setRenderTarget(write);
  gl.render(sim.scene, quadCam);
  composite.mat.uniforms.uScene.value = content.texture;
  composite.mat.uniforms.uHeight.value = write.texture;
  gl.setRenderTarget(null);
  gl.render(composite.scene, quadCam);
  bufs.current = { read: write, write: read };
}

export default function WaterDistort({ debug = false, glSim }: { debug?: boolean; glSim?: GlSim }) {
  const content = useFBO();
  const heightA = useFBO(RES_X, RES_Y, SIM_OPTS);
  const heightB = useFBO(RES_X, RES_Y, SIM_OPTS);
  const bufs = useRef<PingPong>({ read: heightA, write: heightB });
  const pending = useRef<Drop[]>([]); // 指针/wave 滴水：事件回调里 push，useFrame 每帧排空
  const nodes = glSim?.nodes;

  const dropSlots = useMemo(() => Array.from({ length: MAX_DROPS }, () => new Vector4()), []);
  const sim = useMemo(
    () => makeQuadScene(simFrag, {
      uPrev: { value: null },
      uDelta: { value: new Vector2(1 / RES_X, 1 / RES_Y) },
      uDrops: { value: dropSlots },
      uDropCount: { value: 0 },
      uDamping: { value: 0.995 },
      uAspect: { value: 1 }, // K1：每帧由画布宽高比刷新（见 useFrame），校正滴水为正圆
    }),
    [dropSlots],
  );
  const spheresInit = useMemo(() => Array.from({ length: MAX_SPHERES }, () => new Vector4()), []);
  const composite = useMemo(
    () => makeQuadScene(compositeMaskFrag, {
      uScene: { value: content.texture },
      uHeight: { value: heightA.texture },
      uDelta: { value: new Vector2(1 / RES_X, 1 / RES_Y) },
      uPerturb: { value: 0.04 },
      uSpec: { value: 0.5 },
      uWaterLevel: { value: 0 },
      uViewport: { value: new Vector2(1, 1) },
      uSphereCount: { value: 0 },
      uSpheres: { value: spheresInit },
      uDebug: { value: 0 },
    }),
    [content, heightA, spheresInit],
  );
  const quadCam = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  // 指针 + bg-ripple:wave → push 一滴到 pending（坐标 → uv，y 翻转匹配 quad；一次性，不留持续鼠标位）
  useEffect(() => {
    let last = 0;
    const push = (x: number, y: number, str: number) => {
      const t = getRippleTuning();
      pending.current.push({ ux: x / window.innerWidth, uy: 1 - y / window.innerHeight, radius: t.dropRadius, strength: str });
    };
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < 16) return;
      last = now;
      push(e.clientX, e.clientY, getRippleTuning().dropMove);
    };
    const onDown = (e: PointerEvent) => push(e.clientX, e.clientY, getRippleTuning().dropClick);
    const onWave = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number }>;
      push(ce.detail.x, ce.detail.y, getRippleTuning().dropClick);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('bg-ripple:wave', onWave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('bg-ripple:wave', onWave);
    };
  }, []);

  // 切组 / 重建节点 → 清穿越/尾迹记忆，避免旧球的没入状态触发假溅起
  useEffect(() => { resetRippleFeed(); }, [nodes]);

  // 正优先级 = 接管渲染循环（在 SphereInstances priority-0 写完矩阵之后跑）
  useFrame((state) => {
    const t = getRippleTuning();
    // K1：画布宽高比 → 滴水距离度量校正成正圆（仅度量，不动 sim 数学）
    applyTuning(sim, composite, t, debug, state.size.width / Math.max(1, state.size.height));
    const size = glSim ? glSim.sizeRef.current : { w: 1, h: 1 };
    applySpheres(composite, nodes ?? EMPTY_NODES, size.w, size.h, getWaterLevel());
    // 汇集本帧所有滴水：指针/wave（pending）+ 对象涟漪（拖球尾迹/穿越溅起/>6 合并）+ 常驻微波
    const drops = pending.current;
    pending.current = [];
    if (nodes) drops.push(...collectObjectDrops(nodes, size.w, size.h, t));
    const amb = collectAmbientDrop(t);
    if (amb) drops.push(amb);
    writeDrops(sim.mat, drops, dropSlots);
    tick(state.gl, state.scene, state.camera, content, sim, bufs, composite, quadCam);
  }, 1);

  return null;
}
