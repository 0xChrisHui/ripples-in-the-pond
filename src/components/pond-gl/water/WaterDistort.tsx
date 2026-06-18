'use client';

import { useFBO } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  OrthographicCamera,
  Vector4,
  HalfFloatType,
  RGBAFormat,
  LinearFilter,
  ClampToEdgeWrapping,
  type Camera,
  type Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { MAX_DROPS } from './spike/ripple-spike-shaders';
import { getRippleTuning } from './spike/ripple-tuning';
import { MAX_SPHERES } from './water-distort-shaders';
import { getWaterLevel } from './water-level';
import {
  makeSimScene, makeCompositeScene, applyTuning, applySpheres, type QuadScene,
} from './water-distort-setup';
import {
  collectObjectDrops, collectAmbientDrop, writeDrops, resetRippleFeed,
  pointerPathDrops, resetPointerPath, type Drop,
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
  // 保持 ClampToEdge：sim 读 uPrev 也用这块 FBO，改 Repeat 会把波动方程的边界从「夹边软墙」
  // 偷换成「环绕」→ 即便 K6 关也会改变涟漪在边缘的行为，破「OFF=现状」红线。
  // K6 缩小时采样越界 [0,1] 的平铺需求 → 改在合成 shader 里对采样 UV 取 fract() 手动平铺解决（见 compositeMaskFrag），
  // 与 wrap 模式解耦：K6 关时 zoom≡1、不取 fract，与现状逐字一致。
  wrapS: ClampToEdgeWrapping,
  wrapT: ClampToEdgeWrapping,
  depthBuffer: false,
  stencilBuffer: false,
};

interface PingPong {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
}

const EMPTY_NODES: GlPhysNode[] = []; // glSim 未就绪时占位（无球 → 全屏扭）

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

export default function WaterDistort(
  { debug = false, glSim, depthModel = false, sphereShadow = false, shadowOcclude = false, shadowGlow = false, shadowContact = false, caustics = false, waterZoom = false, pondFloor = false, moonReflect = false }:
  { debug?: boolean; glSim?: GlSim; depthModel?: boolean; sphereShadow?: boolean; shadowOcclude?: boolean; shadowGlow?: boolean; shadowContact?: boolean; caustics?: boolean; waterZoom?: boolean; pondFloor?: boolean; moonReflect?: boolean },
) {
  const content = useFBO();
  const heightA = useFBO(RES_X, RES_Y, SIM_OPTS);
  const heightB = useFBO(RES_X, RES_Y, SIM_OPTS);
  const bufs = useRef<PingPong>({ read: heightA, write: heightB });
  const pending = useRef<Drop[]>([]); // 指针/wave 滴水：事件回调里 push，useFrame 每帧排空
  const nodes = glSim?.nodes;

  const dropSlots = useMemo(() => Array.from({ length: MAX_DROPS }, () => new Vector4()), []);
  const sim: QuadScene = useMemo(() => makeSimScene(RES_X, RES_Y, dropSlots), [dropSlots]);
  const spheresInit = useMemo(() => Array.from({ length: MAX_SPHERES }, () => new Vector4()), []);
  const composite: QuadScene = useMemo(
    () => makeCompositeScene(content.texture, heightA.texture, RES_X, RES_Y, spheresInit),
    [content, heightA, spheresInit],
  );
  const quadCam = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  // 指针 + bg-ripple:wave → push 一滴到 pending（坐标 → uv，y 翻转匹配 quad；一次性，不留持续鼠标位）
  useEffect(() => {
    const push = (x: number, y: number, str: number) => {
      const t = getRippleTuning();
      pending.current.push({ ux: x / window.innerWidth, uy: 1 - y / window.innerHeight, radius: t.dropRadius, strength: str });
    };
    // K2：划水改路径插值（按位移触发、上帧↔当前补点连成线）→ 快划连续不"咚咚"
    const onMove = (e: PointerEvent) => {
      pending.current.push(...pointerPathDrops(e.clientX, e.clientY, window.innerWidth, window.innerHeight, getRippleTuning()));
    };
    const onDown = (e: PointerEvent) => { resetPointerPath(); push(e.clientX, e.clientY, getRippleTuning().dropClick); };
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
    // K3：depthModel prop 传进 helper → composite 的深度调制 uniform 每帧刷新
    // K4：sphereShadow prop 传进 helper → composite 的空中球投影 uniform 每帧刷新
    // K5：caustics prop + state.clock 传进 helper → 焦散开关 + 游走流光的时间每帧刷新
    // K6：waterZoom prop 传进 helper → composite 的 uZoomAmount（开=t.zoomAmount/关=0）每帧刷新
    // K10：pondFloor prop 传进 helper → composite 的 uPondFloor（开=1 叠静止暗纹塘底/关=0 现状）每帧刷新
    // K11：moonReflect prop 传进 helper → composite 的 uMoonReflect（开=1 叠大柔月华倒影/关=0 现状）每帧刷新
    applyTuning(sim, composite, t, debug, state.size.width / Math.max(1, state.size.height), depthModel, { dark: sphereShadow, occlude: shadowOcclude, glow: shadowGlow, contact: shadowContact }, caustics, state.clock.getElapsedTime(), waterZoom, pondFloor, moonReflect);
    const size = glSim ? glSim.sizeRef.current : { w: 1, h: 1 };
    applySpheres(composite, nodes ?? EMPTY_NODES, size.w, size.h, getWaterLevel());
    // 汇集本帧所有滴水：指针/wave（pending）+ 对象涟漪（拖球尾迹/穿越溅起/>6 合并）+ 常驻微波
    const drops = pending.current;
    pending.current = [];
    if (nodes) drops.push(...collectObjectDrops(nodes, size.w, size.h, t));
    const amb = collectAmbientDrop(t);
    if (amb) drops.push(amb);
    // K6：缩放开时把滴水位置做同款 inverse-zoom 变换（在 writeDrops 内施加，避免改 drop 对象）→ 涟漪显示位置 = 实际鼠标/球位置
    const iz = waterZoom && t.zoomAmount > 0 ? 1 / Math.max(0.001, 1 + (getWaterLevel() - 0.5) * t.zoomAmount) : 1;
    writeDrops(sim.mat, drops, dropSlots, iz);
    tick(state.gl, state.scene, state.camera, content, sim, bufs, composite, quadCam);
  }, 1);

  return null;
}
