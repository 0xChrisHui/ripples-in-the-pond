/**
 * G 线沙盒开关 — P8-G /test1 GL 渲染层 spike。
 *
 * URL 参数范式抄 effects-config，但**独立文件**：不碰共享热点 effects-config.ts。
 * P8 全局铁律 1 的精神保留：每个 G 功能可单独开关，关 = 回上一步现状。
 *
 * 按 step 增长：G3 先有 glBase / artDir；G4 加 glSpheres；G5 加 water；G6 加 wheelMode。
 */

/** 基调艺术方向两档（G5 拍板）：deep 深蓝墨绿渐晕 / black 纯黑 */
export type ArtDir = 'deep' | 'black';

/** G6 滚轮模式（二选一互斥）：waterLevel 升降水位 / zoomFx 缩放（P2-c 才接 GL 缩放） */
export type WheelMode = 'waterLevel' | 'zoomFx';

export interface GLFlags {
  /** G3 — GL 基调层总开关；false = 卸载 GL，回 G2 纯 SVG 现状 */
  glBase: boolean;
  /** G3 — 基调两档：deep（推荐，夜塘感）/ black（纯黑，更冷） */
  artDir: ArtDir;
  /** G4 — GL 球总开关；true = 隐 SVG 球组 + 显 InstancedMesh 球，false = 回 SVG 球（默认） */
  glSpheres: boolean;
  /** G5 — GL 高度场水面总开关（涟漪 + 月光，球之下/基调之上）；默认关 */
  water: boolean;
  /** 背景图开关（测试用，public/test1-bg.png）；开时替代纯色基调垫最底层。默认关 */
  bgImage: boolean;
  /** G6 — 滚轮模式：waterLevel（默认，升降水位）/ zoomFx（缩放，互斥）。仅水面开时生效 */
  wheelMode: WheelMode;
  /** H1 — RTT 风险 spike（隔离实验）：开时挂 RttSpike 全屏验证离屏渲染+扭曲。默认关 */
  rtt: boolean;
  /** H2 — 扭曲水面：把真场景渲进 FBO 全屏折射扭曲（取代旧程序化 WaterSurface）。默认关 */
  waterFx: boolean;
  /** H3 调试：扭曲水面显示遮罩调试视图（绿=水上/红=水下 + 水位横线）。默认关 */
  waterDbg: boolean;
  /** H5 — 球自驱浮沉（常态自漂 + 播放球浮出成焦点）；关 = 球深度静止（回 H4）。默认关 */
  sphereMotion: boolean;
  /** 新效果 — 球随机飘动（不论水上水下） + 水中球被点击涟漪推动（离水面越远推力越小）；关 = 球不漂、涟漪不推（现状）。默认关 */
  sphereDrift: boolean;
  /** K3 — 深度三层模型：统一球/标题/水面按带符号深度渐变（修 R4 浮沉不一致 + 标题去闪）。默认关 */
  depthModel: boolean;
  /** K4 — 浮出水面（空中）球在下方水面投柔影·暗影（减光）。默认关 */
  sphereShadow: boolean;
  /** K4-B — 投影·挡月光：球挡住下方月光/焦散（乘性夺光，暗塘更自然）。默认关 */
  shadowOcclude: boolean;
  /** K4-C — 投影·反光晕：球在下方水面投淡冷光（加亮，暗塘更显）。默认关 */
  shadowGlow: boolean;
  /** K4-D — 投影·接触影：紧贴球的小柔影（无视差/不随高度涨）。默认关 */
  shadowContact: boolean;
  /** K5 — 水面月光焦散光照（R7 冷白漫反射+游走流光，从哑玻璃变活水）；关 = 无光照（回 K4）。默认关 */
  caustics: boolean;
  /** K6 — 水面深度缩放（R1 按水位绕中心缩放高度场，升放大/降缩小，球不缩放）；关 = 缩放=1（回 K5）。默认关 */
  waterZoom: boolean;
  /** K8 — 水面漂浮微光层（冷白浮尘点阵；绕中心随水位缩放当 K6 参照 + 轻柔游走）；关 = 不挂载（现状）。默认关 */
  floatMotes: boolean;
  /** K9 — 水生植物层（俯视睡莲叶圆片 + 边缘芦苇暗示岸；绕中心随水位缩放当 K6 强参照 + 涟漪轻晃）；关 = 不挂载（现状）。默认关 */
  waterPlants: boolean;
  /** 水面花瓣层（复刻 flower-water-ripples）：GL 之上 2D overlay 画樱花瓣 + 投影，跟同源 CPU 涟漪场漂/起伏。默认关 */
  flowerPetals: boolean;
  /** K10 — 可见塘底层（合成 shader 程序化极淡暗纹；静止不缩 → 动水面在其上产生视差当 K6/K3 参照）；关 = shader 跳过（纯黑塘底现状）。默认关 */
  pondFloor: boolean;
  /** K11 — 月光倒影（合成 shader 一道大柔冷白月华；被涟漪扭碎、随 K6 缩放放缩当参照、点题月夜水塘）；关 = shader 跳过（现状）。默认关 */
  moonReflect: boolean;
  /** K12 — 水位标尺柱·礁石（钉死暗岩 + 顶冷光 + 水线湿痕，水从其身上漫过=水位/深度参照）；默认关 */
  reefStones: boolean;
  /** K12 — 水位标尺柱·水晶簇（钉死冷光半透柱、接月光）；默认关 */
  crystalPillars: boolean;
  /** J1 — 强制走 WebGL 兜底夜塘（测试用，免去手动禁 WebGL）；默认关 */
  forceFallback: boolean;
  /** J3 — 低 FPS 自动降 DPR 保流畅；默认开（保护性，测试可关对比） */
  autoDegrade: boolean;
}

/** /test1 默认：按用户指定打开 GL球 / 球浮动 / 球飘动+涟漪推 / 扭曲水面 / K3深度 / K5焦散 / K6缩放 / K8微光 / K10塘底 / K11倒影 / 水面花瓣，
 *  其余视觉层默认关（含基调——背景改由 K10 可见塘底提供）；autoDegrade 保留(非视觉的性能保护)。仅 /test1 默认，`/` 与 `/test` 零影响。 */
export const DEFAULT_GL_FLAGS: GLFlags = {
  glBase: false,
  artDir: 'deep',
  glSpheres: true,
  water: false,
  bgImage: false,
  wheelMode: 'waterLevel',
  rtt: false,
  waterFx: true,
  waterDbg: false,
  sphereMotion: true,
  sphereDrift: true,
  depthModel: true,
  sphereShadow: false,
  shadowOcclude: false,
  shadowGlow: false,
  shadowContact: false,
  caustics: true,
  waterZoom: true,
  floatMotes: true,
  waterPlants: false,
  flowerPetals: true,
  pondFloor: true,
  moonReflect: true,
  reefStones: false,
  crystalPillars: false,
  forceFallback: false,
  autoDegrade: true,
};

/** 解析单个布尔 flag：'1'/'true'→true，'0'/'false'→false，其余取默认。统一收口，省去逐 flag 重复块。 */
function getBool(sp: URLSearchParams, key: string, dflt: boolean): boolean {
  const v = sp.get(key);
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return dflt;
}

/** 从 URL query 解析 G 线开关（仅覆盖出现的参数，其余取默认） */
export function parseGLFlags(searchParams: URLSearchParams): GLFlags {
  const d = DEFAULT_GL_FLAGS;
  const artDir = searchParams.get('artDir');
  const wheelMode = searchParams.get('wheelMode');
  return {
    glBase: getBool(searchParams, 'glBase', d.glBase),
    artDir: artDir === 'deep' || artDir === 'black' ? artDir : d.artDir,
    glSpheres: getBool(searchParams, 'glSpheres', d.glSpheres),
    water: getBool(searchParams, 'water', d.water),
    bgImage: getBool(searchParams, 'bgImage', d.bgImage),
    wheelMode: wheelMode === 'waterLevel' || wheelMode === 'zoomFx' ? wheelMode : d.wheelMode,
    rtt: getBool(searchParams, 'rtt', d.rtt),
    waterFx: getBool(searchParams, 'waterFx', d.waterFx),
    waterDbg: getBool(searchParams, 'waterDbg', d.waterDbg),
    sphereMotion: getBool(searchParams, 'sphereMotion', d.sphereMotion),
    sphereDrift: getBool(searchParams, 'sphereDrift', d.sphereDrift),
    depthModel: getBool(searchParams, 'depthModel', d.depthModel),
    sphereShadow: getBool(searchParams, 'sphereShadow', d.sphereShadow),
    shadowOcclude: getBool(searchParams, 'shadowOcclude', d.shadowOcclude),
    shadowGlow: getBool(searchParams, 'shadowGlow', d.shadowGlow),
    shadowContact: getBool(searchParams, 'shadowContact', d.shadowContact),
    caustics: getBool(searchParams, 'caustics', d.caustics),
    waterZoom: getBool(searchParams, 'waterZoom', d.waterZoom),
    floatMotes: getBool(searchParams, 'floatMotes', d.floatMotes),
    waterPlants: getBool(searchParams, 'waterPlants', d.waterPlants),
    flowerPetals: getBool(searchParams, 'flowerPetals', d.flowerPetals),
    pondFloor: getBool(searchParams, 'pondFloor', d.pondFloor),
    moonReflect: getBool(searchParams, 'moonReflect', d.moonReflect),
    reefStones: getBool(searchParams, 'reefStones', d.reefStones),
    crystalPillars: getBool(searchParams, 'crystalPillars', d.crystalPillars),
    forceFallback: getBool(searchParams, 'forceFallback', d.forceFallback),
    autoDegrade: getBool(searchParams, 'autoDegrade', d.autoDegrade),
  };
}

/**
 * J1 — WebGL 可用性检测（建测试 canvas 取 webgl2/webgl context，模块级缓存一次）。
 * 放在 gl-flags（无 three 依赖）→ /test1 page 可廉价调用、门控 GL overlay，不拉 three chunk。
 */
let webglCached: boolean | null = null;
export function isWebGLAvailable(): boolean {
  if (webglCached !== null) return webglCached;
  if (typeof document === 'undefined') return true; // SSR 假定可用（client 再判）
  try {
    const c = document.createElement('canvas');
    webglCached = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    webglCached = false;
  }
  return webglCached;
}
