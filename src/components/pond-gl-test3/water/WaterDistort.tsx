'use client';

import { useFBO } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  OrthographicCamera,
  Vector4,
  HalfFloatType,
  RGBAFormat,
  UnsignedByteType,
  LinearFilter,
  ClampToEdgeWrapping,
} from 'three';
import { MAX_DROPS } from './spike/ripple-spike-shaders';
import { getRippleTuning, ZOOM_MIN } from './spike/ripple-tuning';
import { MAX_SPHERES } from './water-distort-shaders';
import { getWaterLevel, getEffectiveWaterLevel } from './water-level';
import { getPointerFx, getCameraFx } from '../pointer-fx';
import type { ProjCtx } from '../sphere-projection';
import { makeSimScene, makeCompositeScene, applyTuning, applySpheres, disposeQuadScene, getHeightFieldSize, type QuadScene } from './water-distort-setup';
import { clearHeightTargets, renderFrame, type FrameTargets } from './composite/render-passes';
import { collectObjectDrops, collectAmbientDrop, writeDrops, resetRippleFeed,
  pointerPathDrops, resetPointerPath, type Drop } from './ripple-feed';
import type { GlSim } from '../spheres/use-gl-sim';
import type { GlPhysNode } from '../spheres/gl-sim-setup';
import { collectKeyFxDrops, sampleKeyFx } from '../key-fx/key-fx-state';
import { getShowcasePose, sampleShowcase } from '../showcase/showcase-state';

/**
 * H2/H3/H4 — 全屏动态扭曲水面（真场景 + 水位深度遮罩 + 涟漪交互全集）。
 *
 * 渲真实 GL 场景（基调/背景/球）进内容 FBO → ping-pong 高度场 → 合成折射 pass 全屏扭（接管渲染循环、返回 null）。
 * H3：球体按逐实例没入值拆成水上/水下 FBO，合成时确定性恢复层级。
 * H4：一帧汇集多滴喂高度场——指针/wave（pending）+ 对象涟漪（拖球尾迹/穿越溅起/>6 合并，见 ripple-feed）
 * + 常驻微波，写进 sim 的 uDrops 数组。命中层是 canvas 之上的 DOM、不进 shader → 点击不受扭曲影响。
 * 注：sim/quadVert/参数 store 暂复用 water/spike/（H 线收尾、spike 退役时挪进 water/ 正式化）。
 */

// Linear 平滑高度场梯度；sim 在 texel 中心采样，波动方程保持不变。
const SIM_OPTS = {
  type: HalfFloatType,
  format: RGBAFormat,
  minFilter: LinearFilter,
  magFilter: LinearFilter,
  // 保持 ClampToEdge，避免把波动边界从夹边软墙偷换成环绕。
  wrapS: ClampToEdgeWrapping,
  wrapT: ClampToEdgeWrapping,
  depthBuffer: false,
  stencilBuffer: false,
};
const SPHERE_OPTS = {
  format: RGBAFormat,
  type: UnsignedByteType,
  minFilter: LinearFilter,
  magFilter: LinearFilter,
  wrapS: ClampToEdgeWrapping,
  wrapT: ClampToEdgeWrapping,
  depthBuffer: false,
  stencilBuffer: false,
  generateMipmaps: false,
};

interface PingPong {
  read: ReturnType<typeof useFBO>;
  write: ReturnType<typeof useFBO>;
}

const EMPTY_NODES: GlPhysNode[] = []; // glSim 未就绪时占位（无球 → 全屏扭）

export default function WaterDistort(
  { debug = false, glSim, sphereDrift = false, depthModel = false, sphereShadow = false, shadowOcclude = false, shadowGlow = false, shadowContact = false, caustics = false, waterZoom = false, pondFloor = false, moonReflect = false, glSpheres = false }:
  { debug?: boolean; glSim?: GlSim; sphereDrift?: boolean; depthModel?: boolean; sphereShadow?: boolean; shadowOcclude?: boolean; shadowGlow?: boolean; shadowContact?: boolean; caustics?: boolean; waterZoom?: boolean; pondFloor?: boolean; moonReflect?: boolean; glSpheres?: boolean },
) {
  const renderer = useThree((s) => s.gl);
  const canvasSize = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const targetWidth = Math.max(1, Math.min(Math.round(canvasSize.width * dpr), renderer.capabilities.maxTextureSize));
  const targetHeight = Math.max(1, Math.min(Math.round(canvasSize.height * dpr), renderer.capabilities.maxTextureSize));
  const heightSize = getHeightFieldSize(canvasSize.width, canvasSize.height, renderer.capabilities.maxTextureSize);
  const backgroundTarget = useFBO(targetWidth, targetHeight);
  const sphereTarget = useFBO(targetWidth, targetHeight, SPHERE_OPTS);
  const aboveSphereTarget = useFBO(targetWidth, targetHeight, SPHERE_OPTS);
  const heightA = useFBO(heightSize.width, heightSize.height, SIM_OPTS);
  const heightB = useFBO(heightSize.width, heightSize.height, SIM_OPTS);
  const bufs = useRef<PingPong>({ read: heightA, write: heightB });
  const resetHeightRef = useRef(true);
  const pending = useRef<Drop[]>([]); // 指针/wave 滴水：事件回调里 push，useFrame 每帧排空
  const nodes = glSim?.nodes;
  // 点击涟漪推：onDown 在 [] useEffect 里读最新 sphereDrift/glSim → 用 ref 同步，避免进依赖反复重绑监听
  const driftRef = useRef(false);
  const glSimRef = useRef<GlSim | undefined>(glSim);
  useEffect(() => { driftRef.current = sphereDrift; glSimRef.current = glSim; });

  const dropSlots = useMemo(() => Array.from({ length: MAX_DROPS }, () => new Vector4()), []);
  const sim: QuadScene = useMemo(() => makeSimScene(heightSize.width, heightSize.height, dropSlots), [dropSlots, heightSize.width, heightSize.height]);
  const spheresInit = useMemo(() => Array.from({ length: MAX_SPHERES }, () => new Vector4()), []);
  const composite = useMemo(
    () => makeCompositeScene(backgroundTarget.texture, heightA.texture, heightSize.width, heightSize.height, spheresInit),
    [backgroundTarget, heightA, heightSize.width, heightSize.height, spheresInit],
  );
  const quadCam = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  useEffect(() => () => {
    disposeQuadScene(sim);
    disposeQuadScene(composite);
  }, [sim, composite]);

  useLayoutEffect(() => {
    bufs.current = { read: heightA, write: heightB };
    resetHeightRef.current = true;
    const canvas = renderer.domElement;
    const onRestore = () => {
      bufs.current = { read: heightA, write: heightB };
      resetHeightRef.current = true;
    };
    canvas.addEventListener('webglcontextrestored', onRestore);
    return () => canvas.removeEventListener('webglcontextrestored', onRestore);
  }, [renderer, heightA, heightB, heightSize.width, heightSize.height]);

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
    const onDown = (e: PointerEvent) => {
      resetPointerPath();
      push(e.clientX, e.clientY, getRippleTuning().dropClick);
      // 点击同位置投一道 BgWave（sim 像素坐标）→ pushGlSpheresByWaves 推水下球（深度衰减 + 滑行惯性）。复刻 /test1
      const gs = glSimRef.current;
      if (driftRef.current && gs) {
        const sz = gs.sizeRef.current;
        const sx = e.clientX * (sz.w / Math.max(1, window.innerWidth));
        const sy = e.clientY * (sz.h / Math.max(1, window.innerHeight));
        gs.wavesRef.current.push({ x: sx, y: sy, size: 300 + Math.random() * 220, spawnTime: performance.now(), duration: 4500 });
      }
    };
    const onWave = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number; strength?: number; radius?: number }>;
      if (ce.detail.strength === 0) return;
      const t = getRippleTuning();
      pending.current.push({
        ux: ce.detail.x / window.innerWidth,
        uy: 1 - ce.detail.y / window.innerHeight,
        radius: ce.detail.radius ?? t.dropRadius,
        strength: ce.detail.strength ?? t.dropClick,
      });
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
    const now = performance.now() / 1000;
    const keyFx = sampleKeyFx(now);
    const quiet = sampleShowcase('quiet', now);
    const showcasePose = getShowcasePose();
    // K1：画布宽高比 → 滴水距离度量校正成正圆（仅度量，不动 sim 数学）
    // K3：depthModel prop 传进 helper → composite 的深度调制 uniform 每帧刷新
    // K4：sphereShadow prop 传进 helper → composite 的空中球投影 uniform 每帧刷新
    // K5：caustics prop + state.clock 传进 helper → 焦散开关 + 游走流光的时间每帧刷新
    // K6：waterZoom prop 传进 helper → composite 的 uZoomAmount（开=t.zoomAmount/关=0）每帧刷新
    // K10：pondFloor prop 传进 helper → composite 的 uPondFloor（开=1 混合静止亮底花纹/关=0 现状）每帧刷新
    // K11：moonReflect prop 传进 helper → composite 的 uMoonReflect（开=1 叠大柔月华倒影/关=0 现状）每帧刷新
    applyTuning(sim, composite, t, debug, state.size.width / Math.max(1, state.size.height), depthModel, { dark: sphereShadow, occlude: shadowOcclude, glow: shadowGlow, contact: shadowContact }, caustics, state.clock.getElapsedTime(), waterZoom, pondFloor, moonReflect, keyFx, { x: showcasePose.x, y: showcasePose.y, progress: quiet.progress, energy: quiet.energy });
    const size = glSim ? glSim.sizeRef.current : { w: 1, h: 1 };
    // /test3 task 4：水位遮罩用与 GL 实例/命中层同款投影 → 透视/视差/深度尺寸下，"水上清晰/水下扭曲"始终贴着球
    const pf = getPointerFx();
    const cfx = getCameraFx();
    const proj: ProjCtx = { cx: (size.w || 1) / 2, cy: (size.h || 1) / 2, mx: pf.mx, my: pf.my, focusZ: getEffectiveWaterLevel(), dof: cfx.dof, perspective: cfx.perspective, parallax: cfx.parallax };
    // 有效水位喂没入判定（全 z 域两端可达 0/1）、原始水位喂 K6 缩放（与 motes/plants/滴水缩放同步）
    applySpheres(composite, nodes ?? EMPTY_NODES, size.w, size.h, getEffectiveWaterLevel(), getWaterLevel(), proj);
    // 汇集本帧所有滴水：指针/wave（pending）+ 对象涟漪（拖球尾迹/穿越溅起/>6 合并）+ 常驻微波
    const drops = pending.current;
    pending.current = [];
    drops.push(...collectKeyFxDrops(now));
    if (nodes) drops.push(...collectObjectDrops(nodes, size.w, size.h, t, proj));
    const amb = collectAmbientDrop(t);
    if (amb) drops.push(amb);
    // K6：缩放开时把滴水位置做同款 inverse-zoom 变换（在 writeDrops 内施加，避免改 drop 对象）→ 涟漪显示位置 = 实际鼠标/球位置
    // 与 shader 同款 ZOOM_MIN 下限 → 大幅度/低水位时滴水不被极小/负 zoom 甩飞（与水面缩放一致）
    const iz = waterZoom && t.zoomAmount > 0 ? 1 / Math.max(ZOOM_MIN, 1 + (getWaterLevel() - 0.5) * t.zoomAmount) : 1;
    writeDrops(sim.mat, drops, dropSlots, iz);
    const targets: FrameTargets = {
      background: backgroundTarget,
      sphere: sphereTarget,
      sphereAbove: aboveSphereTarget,
      heightRead: bufs.current.read,
      heightWrite: bufs.current.write,
    };
    if (resetHeightRef.current) {
      clearHeightTargets(state.gl, targets);
      resetHeightRef.current = false;
    }
    renderFrame(state.gl, state.scene, state.camera, targets, { sim, composite, quadCamera: quadCam }, {
      hasSpheres: glSpheres && !!glSim && glSim.nodes.length > 0,
    });
    bufs.current = { read: targets.heightWrite, write: targets.heightRead };
  }, 1);

  return null;
}
