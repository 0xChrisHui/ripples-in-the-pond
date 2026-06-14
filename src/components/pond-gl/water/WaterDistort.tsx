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
  HalfFloatType,
  RGBAFormat,
  NearestFilter,
  ClampToEdgeWrapping,
  type Camera,
  type IUniform,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { quadVert, simFrag, compositeHeightFrag } from './spike/ripple-spike-shaders';
import { getRippleTuning, type RippleTuning } from './spike/ripple-tuning';

/**
 * H2 — 全屏动态扭曲水面（整合进真场景）。
 *
 * 把 /test1 真实 GL 场景（基调/背景/球）渲进内容 FBO → ping-pong 高度场 → 合成折射 pass 全屏扭整个塘。
 * 沿用 H1 spike 证明的管线（自接管渲染循环，正优先级），唯一差别：内容 = state.scene（真场景），非测试图。
 * "先全屏扭一切"（水上/水下分层留 H3）。命中层是 canvas 之上的 DOM、不进 shader → 点击不受扭曲影响。
 * 注：shader / 参数 store 暂复用 water/spike/（H 线收尾、spike 退役时挪进 water/ 正式化）。
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

/** 把波纹参数 store 同步到 shader uniform（模块级，避 react-hooks/immutability） */
function applyTuning(sim: QuadScene, composite: QuadScene, t: RippleTuning): void {
  sim.mat.uniforms.uDamping.value = t.damping;
  sim.mat.uniforms.uRadius.value = t.dropRadius;
  composite.mat.uniforms.uPerturb.value = t.perturb;
  composite.mat.uniforms.uSpec.value = t.specular;
}

/** 一帧：真场景→内容 FBO，ping-pong sim 推进，合成折射→屏幕。模块级避 immutability lint。 */
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
  gl.render(realScene, realCam); // 真场景（基调/背景/球）→ 内容 FBO
  const { read, write } = bufs.current;
  sim.mat.uniforms.uPrev.value = read.texture;
  (sim.mat.uniforms.uMouse.value as Vector2).copy(mouse);
  sim.mat.uniforms.uStrength.value = strength;
  gl.setRenderTarget(write);
  gl.render(sim.scene, quadCam); // 波动方程推进一步
  composite.mat.uniforms.uScene.value = content.texture;
  composite.mat.uniforms.uHeight.value = write.texture;
  gl.setRenderTarget(null);
  gl.render(composite.scene, quadCam); // 折射合成 → 屏幕
  bufs.current = { read: write, write: read }; // swap
}

export default function WaterDistort() {
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
  const composite = useMemo(
    () => makeQuadScene(compositeHeightFrag, {
      uScene: { value: content.texture },
      uHeight: { value: heightA.texture },
      uDelta: { value: new Vector2(1 / RES, 1 / RES) },
      uPerturb: { value: 0.04 },
      uSpec: { value: 0.5 },
    }),
    [content, heightA],
  );
  const quadCam = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  // 指针 + bg-ripple:wave（切组/hover 涟漪）→ 注入滴水（坐标 → uv，y 翻转匹配 quad）
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
    applyTuning(sim, composite, getRippleTuning());
    tick(state.gl, state.scene, state.camera, content, sim, bufs, composite, quadCam, mouse.current, strength.current);
    strength.current = 0;
  }, 1);

  return null;
}
