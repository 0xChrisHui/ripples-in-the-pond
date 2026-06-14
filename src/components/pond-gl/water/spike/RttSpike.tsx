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
  type IUniform,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { quadVert, contentFrag, simFrag, compositeHeightFrag, MAX_DROPS } from './ripple-spike-shaders';
import { getRippleTuning, type RippleTuning } from './ripple-tuning';

/**
 * H1 spike — RTT + ping-pong 高度场（隔离实验，rtt flag 开时才挂）。
 *
 * 自己接管渲染（正优先级 useFrame + 手动渲三 pass + 返回 null）：这正是 H2 要的架构
 * （内容渲进 FBO → ping-pong 波动 sim → 合成折射 pass 到屏幕）。
 * Step 1 已验 RTT round-trip；Step 2 = 真 jquery.ripples 波动方程 + 鼠标点哪涟漪从哪扩散。
 * 命令式 GPU 写入下沉模块级函数，避 react-hooks/immutability。
 */

const RES = 256; // 高度场分辨率（调研报告：256² 起步）
// sim 是数据纹理：必须 Nearest（调研报告翻车点 #4，drei 默认 Linear 要覆写）
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

/** 建"全屏 quad + 单 shader"场景 */
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

/** 一帧：内容→FBO，ping-pong sim 推进一步，合成折射→屏幕。模块级避 immutability lint。 */
function tick(
  gl: WebGLRenderer,
  content: WebGLRenderTarget,
  contentScene: QuadScene,
  sim: QuadScene,
  bufs: { current: PingPong },
  composite: QuadScene,
  cam: OrthographicCamera,
  mouse: Vector2,
  strength: number,
): void {
  // 1. 内容图案 → 内容 FBO
  gl.setRenderTarget(content);
  gl.render(contentScene.scene, cam);
  // 2. sim：读 read、写 write（波动方程 + 鼠标滴水，单滴写进 uDrops[0]）
  const { read, write } = bufs.current;
  sim.mat.uniforms.uPrev.value = read.texture;
  if (mouse.x >= 0) {
    (sim.mat.uniforms.uDrops.value as Vector4[])[0].set(mouse.x, mouse.y, getRippleTuning().dropRadius, strength);
    sim.mat.uniforms.uDropCount.value = 1;
  } else {
    sim.mat.uniforms.uDropCount.value = 0;
  }
  gl.setRenderTarget(write);
  gl.render(sim.scene, cam);
  // 3. 合成：内容 + 新高度场（梯度折射）→ 屏幕
  composite.mat.uniforms.uScene.value = content.texture;
  composite.mat.uniforms.uHeight.value = write.texture;
  gl.setRenderTarget(null);
  gl.render(composite.scene, cam);
  // 4. swap（翻车点 #1：读写分离，帧末交换）
  bufs.current = { read: write, write: read };
}

/** 把波纹参数 store 同步到 shader uniform（模块级，避 react-hooks/immutability） */
function applyTuning(sim: QuadScene, composite: QuadScene, t: RippleTuning): void {
  sim.mat.uniforms.uDamping.value = t.damping; // 滴水半径改逐滴写（uDrops[i].z），不再走 uniform
  composite.mat.uniforms.uPerturb.value = t.refract;
  composite.mat.uniforms.uSpec.value = t.specular;
}

export default function RttSpike() {
  const content = useFBO();
  const heightA = useFBO(RES, RES, SIM_OPTS);
  const heightB = useFBO(RES, RES, SIM_OPTS);
  const bufs = useRef<PingPong>({ read: heightA, write: heightB });

  const mouse = useRef(new Vector2(-1, -1));
  const strength = useRef(0);

  const contentScene = useMemo(() => makeQuadScene(contentFrag), []);
  const sim = useMemo(
    () => makeQuadScene(simFrag, {
      uPrev: { value: null },
      uDelta: { value: new Vector2(1 / RES, 1 / RES) },
      uDrops: { value: Array.from({ length: MAX_DROPS }, () => new Vector4()) },
      uDropCount: { value: 0 },
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
  const cam = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  // 指针 → 注入涟漪（uv: x=clientX/W, y=1-clientY/H，匹配 quad vUv 的 y 向上）
  useEffect(() => {
    let last = 0;
    const setUv = (e: PointerEvent) =>
      mouse.current.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    const onMove = (e: PointerEvent) => {
      const t = performance.now();
      if (t - last < 16) return; // 节流 ~60Hz
      last = t;
      setUv(e);
      strength.current = getRippleTuning().dropMove; // 移动：低强度连续滴
    };
    const onDown = (e: PointerEvent) => { setUv(e); strength.current = getRippleTuning().dropClick; }; // 点击：高强度一次
    const onLeave = () => mouse.current.set(-1, -1);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  // 正优先级 = 接管渲染循环；自己渲三 pass
  useFrame(({ gl }) => {
    applyTuning(sim, composite, getRippleTuning());
    tick(gl, content, contentScene, sim, bufs, composite, cam, mouse.current, strength.current);
    strength.current = 0; // 一次性滴水用完清零（涟漪靠波动方程自行扩散）
  }, 1);

  return null;
}
