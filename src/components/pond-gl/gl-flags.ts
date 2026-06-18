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
  /** K10 — 可见塘底层（合成 shader 程序化极淡暗纹；静止不缩 → 动水面在其上产生视差当 K6/K3 参照）；关 = shader 跳过（纯黑塘底现状）。默认关 */
  pondFloor: boolean;
  /** J1 — 强制走 WebGL 兜底夜塘（测试用，免去手动禁 WebGL）；默认关 */
  forceFallback: boolean;
  /** J3 — 低 FPS 自动降 DPR 保流畅；默认开（保护性，测试可关对比） */
  autoDegrade: boolean;
}

/** /test1 默认（方向 A 后）：基调 + GL 球默认开（/test1 = GL 沙盒，直接看 GL）；
 *  水面默认关（面板里开）。仅 /test1 默认，`/` 与 `/test` 零影响。 */
export const DEFAULT_GL_FLAGS: GLFlags = {
  glBase: true,
  artDir: 'deep',
  glSpheres: true,
  water: false,
  bgImage: false,
  wheelMode: 'waterLevel',
  rtt: false,
  waterFx: false,
  waterDbg: false,
  sphereMotion: false,
  depthModel: false,
  sphereShadow: false,
  shadowOcclude: false,
  shadowGlow: false,
  shadowContact: false,
  caustics: false,
  waterZoom: false,
  floatMotes: false,
  waterPlants: false,
  pondFloor: false,
  forceFallback: false,
  autoDegrade: true,
};

/** 从 URL query 解析 G 线开关（仅覆盖出现的参数，其余取默认） */
export function parseGLFlags(searchParams: URLSearchParams): GLFlags {
  const result: GLFlags = { ...DEFAULT_GL_FLAGS };

  const glBase = searchParams.get('glBase');
  if (glBase === '0' || glBase === 'false') result.glBase = false;
  else if (glBase === '1' || glBase === 'true') result.glBase = true;

  const artDir = searchParams.get('artDir');
  if (artDir === 'deep' || artDir === 'black') result.artDir = artDir;

  const glSpheres = searchParams.get('glSpheres');
  if (glSpheres === '1' || glSpheres === 'true') result.glSpheres = true;
  else if (glSpheres === '0' || glSpheres === 'false') result.glSpheres = false;

  const water = searchParams.get('water');
  if (water === '1' || water === 'true') result.water = true;
  else if (water === '0' || water === 'false') result.water = false;

  const bgImage = searchParams.get('bgImage');
  if (bgImage === '1' || bgImage === 'true') result.bgImage = true;
  else if (bgImage === '0' || bgImage === 'false') result.bgImage = false;

  const wheelMode = searchParams.get('wheelMode');
  if (wheelMode === 'waterLevel' || wheelMode === 'zoomFx') result.wheelMode = wheelMode;

  const rtt = searchParams.get('rtt');
  if (rtt === '1' || rtt === 'true') result.rtt = true;
  else if (rtt === '0' || rtt === 'false') result.rtt = false;

  const waterFx = searchParams.get('waterFx');
  if (waterFx === '1' || waterFx === 'true') result.waterFx = true;
  else if (waterFx === '0' || waterFx === 'false') result.waterFx = false;

  const waterDbg = searchParams.get('waterDbg');
  if (waterDbg === '1' || waterDbg === 'true') result.waterDbg = true;
  else if (waterDbg === '0' || waterDbg === 'false') result.waterDbg = false;

  const sphereMotion = searchParams.get('sphereMotion');
  if (sphereMotion === '1' || sphereMotion === 'true') result.sphereMotion = true;
  else if (sphereMotion === '0' || sphereMotion === 'false') result.sphereMotion = false;

  const depthModel = searchParams.get('depthModel');
  if (depthModel === '1' || depthModel === 'true') result.depthModel = true;
  else if (depthModel === '0' || depthModel === 'false') result.depthModel = false;

  const sphereShadow = searchParams.get('sphereShadow');
  if (sphereShadow === '1' || sphereShadow === 'true') result.sphereShadow = true;
  else if (sphereShadow === '0' || sphereShadow === 'false') result.sphereShadow = false;

  const shadowOcclude = searchParams.get('shadowOcclude');
  if (shadowOcclude === '1' || shadowOcclude === 'true') result.shadowOcclude = true;
  else if (shadowOcclude === '0' || shadowOcclude === 'false') result.shadowOcclude = false;

  const shadowGlow = searchParams.get('shadowGlow');
  if (shadowGlow === '1' || shadowGlow === 'true') result.shadowGlow = true;
  else if (shadowGlow === '0' || shadowGlow === 'false') result.shadowGlow = false;

  const shadowContact = searchParams.get('shadowContact');
  if (shadowContact === '1' || shadowContact === 'true') result.shadowContact = true;
  else if (shadowContact === '0' || shadowContact === 'false') result.shadowContact = false;

  const caustics = searchParams.get('caustics');
  if (caustics === '1' || caustics === 'true') result.caustics = true;
  else if (caustics === '0' || caustics === 'false') result.caustics = false;

  const waterZoom = searchParams.get('waterZoom');
  if (waterZoom === '1' || waterZoom === 'true') result.waterZoom = true;
  else if (waterZoom === '0' || waterZoom === 'false') result.waterZoom = false;

  const floatMotes = searchParams.get('floatMotes');
  if (floatMotes === '1' || floatMotes === 'true') result.floatMotes = true;
  else if (floatMotes === '0' || floatMotes === 'false') result.floatMotes = false;

  const waterPlants = searchParams.get('waterPlants');
  if (waterPlants === '1' || waterPlants === 'true') result.waterPlants = true;
  else if (waterPlants === '0' || waterPlants === 'false') result.waterPlants = false;

  const pondFloor = searchParams.get('pondFloor');
  if (pondFloor === '1' || pondFloor === 'true') result.pondFloor = true;
  else if (pondFloor === '0' || pondFloor === 'false') result.pondFloor = false;

  const forceFallback = searchParams.get('forceFallback');
  if (forceFallback === '1' || forceFallback === 'true') result.forceFallback = true;
  else if (forceFallback === '0' || forceFallback === 'false') result.forceFallback = false;

  const autoDegrade = searchParams.get('autoDegrade');
  if (autoDegrade === '0' || autoDegrade === 'false') result.autoDegrade = false;
  else if (autoDegrade === '1' || autoDegrade === 'true') result.autoDegrade = true;

  return result;
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
