/**
 * K3 — WaterDistort 的「场景工厂 + 每帧 helper」抽取。
 *
 * 从 WaterDistort.tsx 拆出来腾行数：①makeQuadScene 全屏 quad 材质工厂；②applyTuning/applySpheres
 * 两个模块级 helper（每帧写 material 真身 uniforms.X.value —— 避 react-hooks/immutability、躲 R3F
 * "拷贝 uniforms 对象"陷阱）。K3 在 composite 工厂里新增 4 个深度 uniform，并在 applyTuning 里逐帧赋值。
 */

import {
  Scene,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
  type IUniform,
} from 'three';
import { quadVert, simFrag } from './spike/ripple-spike-shaders';
import type { RippleTuning } from './spike/ripple-tuning';
import { compositeMaskFrag, MAX_SPHERES } from './water-distort-shaders';
import type { GlPhysNode } from '../spheres/gl-sim-setup';
import { project, applyFloat, type ProjCtx } from '../sphere-projection';
import { depthOf, displayDepthOf } from '../pointer-fx';

export interface QuadScene {
  scene: Scene;
  mat: ShaderMaterial;
  geometry: PlaneGeometry;
}

/** 全屏 quad（裁剪空间 2×2 平面）+ 给定 frag 的材质。uniforms 必须在此内部由对象字面量声明，
 *  外层传入也会被 R3F 拷贝 → 之后只改 mat.uniforms.X.value 真身（见 applyTuning/applySpheres）。 */
export function makeQuadScene(frag: string, uniforms?: Record<string, IUniform>): QuadScene {
  const mat = new ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms });
  const scene = new Scene();
  const geometry = new PlaneGeometry(2, 2);
  scene.add(new Mesh(geometry, mat));
  return { scene, mat, geometry };
}

/** 只释放工厂手工创建、由当前 quad 独占的 GPU 资源。 */
export function disposeQuadScene(quad: QuadScene): void {
  quad.geometry.dispose();
  quad.mat.dispose();
}

/** 纵向维持 256 预算，横向随 Canvas 比例变化，保证屏上网格近似正方形。 */
export function getHeightFieldSize(width: number, height: number, maxTextureSize: number) {
  const targetHeight = Math.max(1, Math.min(256, maxTextureSize));
  const targetWidth = Math.max(1, Math.min(
    maxTextureSize,
    1024,
    Math.max(64, Math.round(targetHeight * width / Math.max(1, height))),
  ));
  return { width: targetWidth, height: targetHeight };
}

/** sim 高度场材质：滴水/阻尼/宽高比校正（K1）。每帧由 useFrame 写 uDrops 后调本工厂建一次。 */
export function makeSimScene(resX: number, resY: number, dropSlots: Vector4[]): QuadScene {
  return makeQuadScene(simFrag, {
    uPrev: { value: null },
    uDelta: { value: new Vector2(1 / resX, 1 / resY) },
    uDrops: { value: dropSlots },
    uDropCount: { value: 0 },
    uDamping: { value: 0.995 },
    uWaveSpeed: { value: 0.5 }, // 水波传播速度（参数板 waveProp，每帧刷新）
    uAspect: { value: 1 }, // K1：每帧由画布宽高比刷新（见 WaterDistort useFrame），校正滴水为正圆
  });
}

/** 合成材质：真场景折射 + 水位遮罩 + 月光高光。K3 加 4 个深度 uniform（默认值 = OFF/恒等，见 shader）。 */
export function makeCompositeScene(
  sceneTex: IUniform['value'],
  heightTex: IUniform['value'],
  resX: number,
  resY: number,
  spheresInit: Vector4[],
  fragmentShader = compositeMaskFrag,
): QuadScene {
  return makeQuadScene(fragmentShader, {
    uBackgroundScene: { value: sceneTex },
    uSphereScene: { value: null },
    uAboveSphereScene: { value: null },
    uHasSpheres: { value: 0 },
    uHeight: { value: heightTex },
    uDelta: { value: new Vector2(1 / resX, 1 / resY) },
    uPerturb: { value: 0.04 },
    uSpec: { value: 0.5 },
    uWaterLevel: { value: 0 },    // 有效水位（没入判定）
    uWaterLevelRaw: { value: 0 }, // 原始水位（K6 缩放/debug 横线）
    uViewport: { value: new Vector2(1, 1) },
    uSphereCount: { value: 0 },
    uSpheres: { value: spheresInit },
    uVisualDim: { value: Array.from({ length: MAX_SPHERES }, () => 1) }, // P8-L：来自 SphereInstances 的单一整体可见度
    uDebug: { value: 0 },
    // K3 深度三层模型：uDepthModel<0.5 时 shader 调制系数恒 1 → 与现状逐字一致
    uDepthModel: { value: 0 },
    uPondDepth: { value: 0.5 },
    uRefrExp: { value: 1.4 },
    uMoonExp: { value: 1.2 },
    // K4 空中球水面投影：uSphereShowing<0.5 时 shader 跳过投影 → 与现状逐字一致
    uSphereShowing: { value: 0 },
    uShadowStrength: { value: 0.3 },
    uShadowHeight: { value: 1.2 }, // K4 高度影响增益（拉高=层级差更显）
    uShadowOcclude: { value: 0 },  // K4-B 挡月光
    uShadowGlow: { value: 0 },     // K4-C 反光晕
    uShadowContact: { value: 0 },  // K4-D 接触影
    // K5 月光焦散光照：uCaustics<0.5 时 shader 跳过光照 → 与现状逐字一致；uTime 每帧由 state.clock 刷新
    uCaustics: { value: 0 },
    uCausticsStrength: { value: 0.4 },
    uTime: { value: 0 },
    // K6 水面深度缩放：uZoomAmount=0 时高度场采样缩放系数恒 1 → 与现状逐字一致（开关关时此值即 0）
    uZoomAmount: { value: 0 },
    // K10 可见塘底：uPondFloor<0.5 时 shader 跳过 → 纯黑塘底现状；uPondFloorStrength 极小（极淡暗纹）
    uPondFloor: { value: 0 },
    uPondFloorStrength: { value: 0.05 },
    uPondFloorStyle: { value: 0 }, // K10 花纹选择（0–4）
    // K11 月光倒影：uMoonReflect<0.5 时 shader 跳过 → 现状；uMoonReflectStrength 克制（≤0.5、偏一侧不盖球）
    uMoonReflect: { value: 0 },
    uMoonReflectStrength: { value: 0.4 },
    // 严格分层：水上球不吃水光；这里只保留水下球增亮与波纹参数。
    uBallLightBelow: { value: 0.15 },
    uWaveOnBall: { value: 0.6 }, // 水下球波纹增强（提升水下感；面板可调）
    uQuietWave: { value: new Vector4(0.5, 0.5, 0, 0) }, // P9-D：中心xy / 扩张进度 / 静止能量
  });
}

/** 每帧写 sim/composite 的标量 uniform（参数板 + debug + 宽高比 + K3 深度调制 + K4 投影 + K5 焦散）。模块级避 immutability。 */
export function applyTuning(
  sim: QuadScene,
  composite: QuadScene,
  t: RippleTuning,
  debug: boolean,
  aspect: number,
  depthModel: boolean,
  shadow: { dark: boolean; occlude: boolean; glow: boolean; contact: boolean }, // K4 投影四模式
  caustics: boolean,
  time: number,
  waterZoom: boolean,
  pondFloor: boolean,
  moonReflect: boolean,
  keyFx: { water: number; moon: number },
  quiet: { x: number; y: number; progress: number; energy: number },
): void {
  sim.mat.uniforms.uDamping.value = Math.min(0.995, t.damping + keyFx.water * 0.012); // 按键余韵只临时延长，不写回 store
  sim.mat.uniforms.uWaveSpeed.value = t.waveProp * (1 + keyFx.water * 0.12);
  sim.mat.uniforms.uAspect.value = aspect;     // K1：高度场方形被拉满宽屏 → 按宽高比校正滴水为正圆
  composite.mat.uniforms.uPerturb.value = Math.min(3, t.refract + keyFx.water * 0.45);
  composite.mat.uniforms.uSpec.value = Math.min(1.5, t.specular + keyFx.water * 0.35 + keyFx.moon * 0.3);
  composite.mat.uniforms.uDebug.value = debug ? 1 : 0;
  // K3：depthModel 开 → shader 按逐球水下深度 d 调制折射(深重)/月光(近强)；关 → 系数恒 1（现状）
  composite.mat.uniforms.uDepthModel.value = depthModel ? 1 : 0;
  composite.mat.uniforms.uPondDepth.value = t.pondDepth;
  composite.mat.uniforms.uRefrExp.value = t.refrExp;
  composite.mat.uniforms.uMoonExp.value = t.moonExp;
  // K4：四种投影模式各自开关（暗影/挡月光/反光晕/接触影；都关 → shader 跳过 = 现状）
  composite.mat.uniforms.uSphereShowing.value = shadow.dark ? 1 : 0;
  composite.mat.uniforms.uShadowOcclude.value = shadow.occlude ? 1 : 0;
  composite.mat.uniforms.uShadowGlow.value = shadow.glow ? 1 : 0;
  composite.mat.uniforms.uShadowContact.value = shadow.contact ? 1 : 0;
  composite.mat.uniforms.uShadowStrength.value = t.shadowStrength;
  composite.mat.uniforms.uShadowHeight.value = t.shadowHeight; // K4 高度对投影影响的总增益
  // K5：caustics 开 → shader 叠冷白月光焦散光照（uTime 驱游走流光）；关 → 跳过（现状）
  composite.mat.uniforms.uCaustics.value = caustics ? 1 : 0;
  composite.mat.uniforms.uCausticsStrength.value = Math.min(1, t.causticsStrength + keyFx.moon * 0.38);
  composite.mat.uniforms.uTime.value = time; // state.clock.getElapsedTime()：光池/光带每帧前进 → 静止也活
  // K6：waterZoom 开 → shader 按水位绕中心缩放高度场采样（升放大/降缩小）；关 → 0（缩放系数恒 1=现状）
  composite.mat.uniforms.uZoomAmount.value = waterZoom ? t.zoomAmount : 0;
  // K10：pondFloor 开 → shader 叠极淡静止暗纹塘底（动水面在其上产生视差）；关 → 0（跳过 = 纯黑塘底现状）
  composite.mat.uniforms.uPondFloor.value = pondFloor ? 1 : 0;
  composite.mat.uniforms.uPondFloorStrength.value = t.pondFloorStrength;
  composite.mat.uniforms.uPondFloorStyle.value = t.pondFloorStyle;
  // K11：moonReflect 开 → shader 叠大柔冷白月华倒影（被涟漪扭碎、随 K6 缩放）；关 → 0（跳过 = 现状）
  composite.mat.uniforms.uMoonReflect.value = moonReflect ? 1 : 0;
  composite.mat.uniforms.uMoonReflectStrength.value = Math.min(1, t.moonReflectStrength + keyFx.moon * 0.42);
  // 水下球环境光独立于全局强度；水上球在 shader 中固定为零。
  composite.mat.uniforms.uBallLightBelow.value = Math.min(1, t.ballLightBelow + keyFx.moon * 0.16);
  composite.mat.uniforms.uWaveOnBall.value = Math.min(1.5, t.waveOnBall + keyFx.water * 0.42);
  (composite.mat.uniforms.uQuietWave.value as Vector4).set(quiet.x, 1 - quiet.y, quiet.progress, quiet.energy);
}

/** 把球数据写进 uniform 数组（位置/半径×可见度/深度），供合成 shader 逐像素算水位遮罩。模块级避 immutability。 */
export function applySpheres(
  composite: QuadScene,
  nodes: GlPhysNode[],
  w: number,
  h: number,
  waterLevelEff: number,  // 有效水位（没入判定：computeAbove/computeDepth/computeShadow）
  waterLevelRaw: number,  // 原始水位 current（K6 缩放/debug 横线）
  proj: ProjCtx,          // /test3 task 4：与 GL 实例/命中层同款投影 → 水位遮罩贴着投影后的球
): void {
  const arr = composite.mat.uniforms.uSpheres.value as Vector4[];
  const visualDim = composite.mat.uniforms.uVisualDim.value as number[];
  const n = Math.min(nodes.length, MAX_SPHERES);
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    visualDim[i] = node._visualDim ?? 1;
    // /test3：位置/半径走 project()，深度用 effDepth(node.z)（层模型 + 滚轮集体偏移）→ 与渲染进 FBO 的球对齐；
    // 没入判定深度用 effDepth(displayZ)（含浮沉），滚轮集体下潜/上浮时水上清晰/水下扭曲随之整体变。
    const dz = displayDepthOf(node); // 没入判定深度（displayZ 浮沉 + 滚轮 + _shiftOff）
    // 位置/半径经 applyFloat 跟随浮动（与 GL 球/命中层同一套）→ 水面遮罩贴着浮动后的球，不分离
    const p = applyFloat(project(node.x ?? 0, node.y ?? 0, depthOf(node), proj, node), node, proj.cx, proj.cy);
    arr[i].set(p.sx, p.sy, node.radius * 1.15 * p.scale, dz);
  }
  composite.mat.uniforms.uSphereCount.value = n;
  (composite.mat.uniforms.uViewport.value as Vector2).set(w || 1, h || 1);
  composite.mat.uniforms.uWaterLevel.value = waterLevelEff;
  composite.mat.uniforms.uWaterLevelRaw.value = waterLevelRaw;
}
