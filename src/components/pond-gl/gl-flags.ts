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

  return result;
}
