/**
 * /test3 GL 沙盒开关（/test1 gl-flags 的 fork）。
 *
 * URL 参数范式抄 effects-config，独立文件。每个功能可单独开关，关 = 回上一步现状。
 * /test3 改动：默认值按 task 4 调（见 DEFAULT_GL_FLAGS）；新增相机三效 dof/perspective/parallax；
 * parseGLFlags 用 parseBool 收敛重复（仅 fork，语义与原逐字一致）。
 */

/** 基调艺术方向两档：deep 深蓝墨绿渐晕 / black 纯黑 */
export type ArtDir = 'deep' | 'black';

/** G6 滚轮模式：waterLevel 升降水位 / zoomFx 缩放 */
export type WheelMode = 'waterLevel' | 'zoomFx';

export interface GLFlags {
  glBase: boolean;        // G3 GL 基调层总开关
  artDir: ArtDir;         // G3 基调两档 deep/black
  glSpheres: boolean;     // G4 GL 球总开关
  water: boolean;         // G5 旧程序化水面
  bgImage: boolean;       // 背景图（public/test1-bg.png）
  wheelMode: WheelMode;   // G6 滚轮模式（/test3 已不用，滚轮归 pointer-fx）
  rtt: boolean;           // H1 RTT 验证 spike
  waterFx: boolean;       // H2 扭曲水面（FBO 折射）
  waterDbg: boolean;      // H3 扭曲水面遮罩调试
  sphereMotion: boolean;  // H5 球浮沉（/test3「球浮动」开关）
  sphereDrift: boolean;   // 球飘动+涟漪推：随机游走(x/y) + 水中球被点击/切组涟漪推动（与沉浮正交，可同开）
  depthModel: boolean;    // K3 深度三层模型
  sphereShadow: boolean;  // K4 浮出球水面投影·暗影
  shadowOcclude: boolean; // K4-B 投影挡月光
  shadowGlow: boolean;    // K4-C 投影反光晕
  shadowContact: boolean; // K4-D 接触影
  caustics: boolean;      // K5 月光焦散
  waterZoom: boolean;     // K6 水面深度缩放
  floatMotes: boolean;    // K8 漂浮微光
  flowerPetals: boolean;  // 水面花瓣（2D overlay；出水球盖花瓣）
  waterPlants: boolean;   // K9 水生植物
  pondFloor: boolean;     // K10 可见塘底
  moonReflect: boolean;   // K11 月光倒影
  reefStones: boolean;    // K12 礁石
  crystalPillars: boolean;// K12 水晶柱
  forceFallback: boolean; // J1 强制 WebGL 兜底
  autoDegrade: boolean;   // J3 低 FPS 自动降 DPR（默认开）
  // ↓↓ /test3 task 4 相机三效（控制台按钮，移植自 /test，统一在 sphere-projection 里按这三个 flag 门控）↓↓
  dof: boolean;           // 焦平面景深（失焦虚化，对焦面=水线）
  perspective: boolean;   // 一点透视（深度尺寸 + 滚轮绕中心聚散缩放）
  parallax: boolean;      // 鼠标视差（按深度分层位移）
}

/** /test3 默认：控制台只暴露 11 项（7 视觉层 + 球浮动 + 相机三效），其余常驻行为在此定死。仅 fork 生效。 */
export const DEFAULT_GL_FLAGS: GLFlags = {
  glBase: true,
  artDir: 'deep',
  glSpheres: true,
  water: false,
  bgImage: false,
  wheelMode: 'waterLevel',
  rtt: false,
  waterFx: true,         // 扭曲水面常驻
  waterDbg: false,
  sphereMotion: true,    // 球浮动默认开（用户指定）
  sphereDrift: true,     // 球飘动+涟漪推：默认开（移自 /test1；只动 x/y，与沉浮和谐共存）
  depthModel: true,      // 水下按深度折射
  sphereShadow: false,
  shadowOcclude: false,
  shadowGlow: false,
  shadowContact: false,
  caustics: true,        // 月光焦散默认开
  waterZoom: false,      // 水面自身不缩放；缩放交给相机一点透视
  floatMotes: false,     // 漂浮微光默认关（用户指定）
  flowerPetals: true,    // 水面花瓣默认开（用户指定）
  waterPlants: false,
  pondFloor: true,       // 可见塘底默认开
  moonReflect: true,     // 月光倒影默认开
  reefStones: false,
  crystalPillars: false,
  forceFallback: false,
  autoDegrade: true,
  dof: true,             // 景深默认开
  perspective: true,     // 一点透视默认开
  parallax: true,        // 鼠标视差默认开
};

/** URL bool 解析：'1'/'true'→true、'0'/'false'→false、其余→默认（与原逐字段写法语义一致）。 */
function parseBool(sp: URLSearchParams, key: string, dflt: boolean): boolean {
  const v = sp.get(key);
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return dflt;
}

/** 从 URL query 解析开关（仅覆盖出现的参数，其余取默认）。 */
export function parseGLFlags(searchParams: URLSearchParams): GLFlags {
  const d = DEFAULT_GL_FLAGS;
  const artDir = searchParams.get('artDir');
  const wheelMode = searchParams.get('wheelMode');
  return {
    ...d,
    artDir: artDir === 'deep' || artDir === 'black' ? artDir : d.artDir,
    wheelMode: wheelMode === 'waterLevel' || wheelMode === 'zoomFx' ? wheelMode : d.wheelMode,
    glBase: parseBool(searchParams, 'glBase', d.glBase),
    glSpheres: parseBool(searchParams, 'glSpheres', d.glSpheres),
    water: parseBool(searchParams, 'water', d.water),
    bgImage: parseBool(searchParams, 'bgImage', d.bgImage),
    rtt: parseBool(searchParams, 'rtt', d.rtt),
    waterFx: parseBool(searchParams, 'waterFx', d.waterFx),
    waterDbg: parseBool(searchParams, 'waterDbg', d.waterDbg),
    sphereMotion: parseBool(searchParams, 'sphereMotion', d.sphereMotion),
    sphereDrift: parseBool(searchParams, 'sphereDrift', d.sphereDrift),
    depthModel: parseBool(searchParams, 'depthModel', d.depthModel),
    sphereShadow: parseBool(searchParams, 'sphereShadow', d.sphereShadow),
    shadowOcclude: parseBool(searchParams, 'shadowOcclude', d.shadowOcclude),
    shadowGlow: parseBool(searchParams, 'shadowGlow', d.shadowGlow),
    shadowContact: parseBool(searchParams, 'shadowContact', d.shadowContact),
    caustics: parseBool(searchParams, 'caustics', d.caustics),
    waterZoom: parseBool(searchParams, 'waterZoom', d.waterZoom),
    floatMotes: parseBool(searchParams, 'floatMotes', d.floatMotes),
    flowerPetals: parseBool(searchParams, 'flowerPetals', d.flowerPetals),
    waterPlants: parseBool(searchParams, 'waterPlants', d.waterPlants),
    pondFloor: parseBool(searchParams, 'pondFloor', d.pondFloor),
    moonReflect: parseBool(searchParams, 'moonReflect', d.moonReflect),
    reefStones: parseBool(searchParams, 'reefStones', d.reefStones),
    crystalPillars: parseBool(searchParams, 'crystalPillars', d.crystalPillars),
    forceFallback: parseBool(searchParams, 'forceFallback', d.forceFallback),
    autoDegrade: parseBool(searchParams, 'autoDegrade', d.autoDegrade),
    dof: parseBool(searchParams, 'dof', d.dof),
    perspective: parseBool(searchParams, 'perspective', d.perspective),
    parallax: parseBool(searchParams, 'parallax', d.parallax),
  };
}

/**
 * J1 — WebGL 可用性检测（建测试 canvas 取 webgl2/webgl context，模块级缓存一次）。
 */
let webglCached: boolean | null = null;
export function isWebGLAvailable(): boolean {
  if (webglCached !== null) return webglCached;
  if (typeof document === 'undefined') return true;
  try {
    const c = document.createElement('canvas');
    webglCached = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    webglCached = false;
  }
  return webglCached;
}
