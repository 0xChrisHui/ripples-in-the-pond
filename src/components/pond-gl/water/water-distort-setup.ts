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

export interface QuadScene {
  scene: Scene;
  mat: ShaderMaterial;
}

/** 全屏 quad（裁剪空间 2×2 平面）+ 给定 frag 的材质。uniforms 必须在此内部由对象字面量声明，
 *  外层传入也会被 R3F 拷贝 → 之后只改 mat.uniforms.X.value 真身（见 applyTuning/applySpheres）。 */
export function makeQuadScene(frag: string, uniforms?: Record<string, IUniform>): QuadScene {
  const mat = new ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms });
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(2, 2), mat));
  return { scene, mat };
}

/** sim 高度场材质：滴水/阻尼/宽高比校正（K1）。每帧由 useFrame 写 uDrops 后调本工厂建一次。 */
export function makeSimScene(resX: number, resY: number, dropSlots: Vector4[]): QuadScene {
  return makeQuadScene(simFrag, {
    uPrev: { value: null },
    uDelta: { value: new Vector2(1 / resX, 1 / resY) },
    uDrops: { value: dropSlots },
    uDropCount: { value: 0 },
    uDamping: { value: 0.995 },
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
): QuadScene {
  return makeQuadScene(compositeMaskFrag, {
    uScene: { value: sceneTex },
    uHeight: { value: heightTex },
    uDelta: { value: new Vector2(1 / resX, 1 / resY) },
    uPerturb: { value: 0.04 },
    uSpec: { value: 0.5 },
    uWaterLevel: { value: 0 },
    uViewport: { value: new Vector2(1, 1) },
    uSphereCount: { value: 0 },
    uSpheres: { value: spheresInit },
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
): void {
  sim.mat.uniforms.uDamping.value = t.damping; // 滴水半径改逐滴写（uDrops[i].z）
  sim.mat.uniforms.uAspect.value = aspect;     // K1：高度场方形被拉满宽屏 → 按宽高比校正滴水为正圆
  composite.mat.uniforms.uPerturb.value = t.refract;
  composite.mat.uniforms.uSpec.value = t.specular;
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
  composite.mat.uniforms.uCausticsStrength.value = t.causticsStrength;
  composite.mat.uniforms.uTime.value = time; // state.clock.getElapsedTime()：光池/光带每帧前进 → 静止也活
  // K6：waterZoom 开 → shader 按水位绕中心缩放高度场采样（升放大/降缩小）；关 → 0（缩放系数恒 1=现状）
  composite.mat.uniforms.uZoomAmount.value = waterZoom ? t.zoomAmount : 0;
}

/** 把球数据写进 uniform 数组（位置/半径/深度），供合成 shader 逐像素算水位遮罩。模块级避 immutability。 */
export function applySpheres(
  composite: QuadScene,
  nodes: GlPhysNode[],
  w: number,
  h: number,
  waterLevel: number,
): void {
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
