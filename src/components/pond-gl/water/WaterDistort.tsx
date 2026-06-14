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
  NearestFilter,
  ClampToEdgeWrapping,
  type Camera,
  type IUniform,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { quadVert, simFrag } from './spike/ripple-spike-shaders';
import { getRippleTuning, type RippleTuning } from './spike/ripple-tuning';
import { compositeMaskFrag, MAX_SPHERES } from './water-distort-shaders';
import { getWaterLevel } from './water-level';
import type { GlSim } from '../spheres/use-gl-sim';
import type { GlPhysNode } from '../spheres/gl-sim-setup';

/**
 * H2/H3 — 全屏动态扭曲水面（整合进真场景 + 水位深度遮罩）。
 *
 * 渲真实 GL 场景（基调/背景/球）进内容 FBO → ping-pong 高度场 → 合成折射 pass 全屏扭（接管渲染循环、返回 null）。
 * H3：把球的坐标/半径/深度当 uniform 数组传进合成 shader，逐像素算"露出水面程度"——
 * 露出水面(z>L)的球不扭(清晰)、水下的扭。（不渲离屏 z 图：换材质在 R3F+InstancedMesh 上不稳。）
 * 命中层是 canvas 之上的 DOM、不进 shader → 点击不受扭曲影响。
 * 注：sim/quadVert/参数 store 暂复用 water/spike/（H 线收尾、spike 退役时挪进 water/ 正式化）。
 */

const RES = 256;
const SIM_OPTS = {
  type: HalfFloatType,
  format: RGBAFormat,
  minFilter: NearestFilter,
  magFilter: NearestFilter,
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

function applyTuning(sim: QuadScene, composite: QuadScene, t: RippleTuning, debug: boolean): void {
  sim.mat.uniforms.uDamping.value = t.damping;
  sim.mat.uniforms.uRadius.value = t.dropRadius;
  composite.mat.uniforms.uPerturb.value = t.perturb;
  composite.mat.uniforms.uSpec.value = t.specular;
  composite.mat.uniforms.uDebug.value = debug ? 1 : 0;
}

/** 把球数据写进 uniform 数组（位置/半径/深度），供合成 shader 逐像素算水位遮罩。模块级避 immutability。 */
function applySpheres(composite: QuadScene, nodes: GlPhysNode[], w: number, h: number, waterLevel: number): void {
  const arr = composite.mat.uniforms.uSpheres.value as Vector4[];
  const n = Math.min(nodes.length, MAX_SPHERES);
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    arr[i].set(node.x ?? 0, node.y ?? 0, node.radius * 1.15, node.z); // 半径放大覆盖光晕
  }
  composite.mat.uniforms.uSphereCount.value = n;
  (composite.mat.uniforms.uViewport.value as Vector2).set(w || 1, h || 1);
  composite.mat.uniforms.uWaterLevel.value = waterLevel;
}

/** 一帧：真场景→内容 FBO，ping-pong sim 推进，合成折射(带遮罩)→屏幕。 */
function tick(
  gl: WebGLRenderer,
  realScene: Scene,
  realCam: Camera,
  content: WebGLRenderTarget,
  sim: QuadScene,
  bufs: { current: PingPong },
  composite: QuadScene,
  quadCam: OrthographicCamera,
  mouse: Vector2,
  strength: number,
): void {
  gl.setRenderTarget(content);
  gl.render(realScene, realCam);
  const { read, write } = bufs.current;
  sim.mat.uniforms.uPrev.value = read.texture;
  (sim.mat.uniforms.uMouse.value as Vector2).copy(mouse);
  sim.mat.uniforms.uStrength.value = strength;
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
  const heightA = useFBO(RES, RES, SIM_OPTS);
  const heightB = useFBO(RES, RES, SIM_OPTS);
  const bufs = useRef<PingPong>({ read: heightA, write: heightB });
  const mouse = useRef(new Vector2(-1, -1));
  const strength = useRef(0);

  const sim = useMemo(
    () => makeQuadScene(simFrag, {
      uPrev: { value: null },
      uDelta: { value: new Vector2(1 / RES, 1 / RES) },
      uMouse: { value: new Vector2(-1, -1) },
      uRadius: { value: 0.05 },
      uStrength: { value: 0 },
      uDamping: { value: 0.995 },
    }),
    [],
  );
  const spheresInit = useMemo(() => Array.from({ length: MAX_SPHERES }, () => new Vector4()), []);
  const composite = useMemo(
    () => makeQuadScene(compositeMaskFrag, {
      uScene: { value: content.texture },
      uHeight: { value: heightA.texture },
      uDelta: { value: new Vector2(1 / RES, 1 / RES) },
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

  // 指针 + bg-ripple:wave → 注入滴水（坐标 → uv，y 翻转匹配 quad）
  useEffect(() => {
    let last = 0;
    const setUv = (x: number, y: number) =>
      mouse.current.set(x / window.innerWidth, 1 - y / window.innerHeight);
    const onMove = (e: PointerEvent) => {
      const t = performance.now();
      if (t - last < 16) return;
      last = t;
      setUv(e.clientX, e.clientY);
      strength.current = getRippleTuning().dropMove;
    };
    const onDown = (e: PointerEvent) => { setUv(e.clientX, e.clientY); strength.current = getRippleTuning().dropClick; };
    const onLeave = () => mouse.current.set(-1, -1);
    const onWave = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number }>;
      setUv(ce.detail.x, ce.detail.y);
      strength.current = getRippleTuning().dropClick;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('bg-ripple:wave', onWave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('bg-ripple:wave', onWave);
    };
  }, []);

  // 正优先级 = 接管渲染循环（在 SphereInstances priority-0 写完矩阵之后跑）
  useFrame((state) => {
    applyTuning(sim, composite, getRippleTuning(), debug);
    const size = glSim ? glSim.sizeRef.current : { w: 1, h: 1 };
    applySpheres(composite, glSim ? glSim.nodes : EMPTY_NODES, size.w, size.h, getWaterLevel());
    tick(state.gl, state.scene, state.camera, content, sim, bufs, composite, quadCam, mouse.current, strength.current);
    strength.current = 0;
  }, 1);

  return null;
}
