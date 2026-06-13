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

export interface GLFlags {
  /** G3 — GL 基调层总开关；false = 卸载 GL，回 G2 纯 SVG 现状 */
  glBase: boolean;
  /** G3 — 基调两档：deep（推荐，夜塘感）/ black（纯黑，更冷） */
  artDir: ArtDir;
  /** G4 — GL 球总开关；true = 隐 SVG 球组 + 显 InstancedMesh 球，false = 回 SVG 球（默认） */
  glSpheres: boolean;
}

/** /test1 默认：开 GL 基调 + deep 档；球默认仍走 SVG（沙盒铁律：每步 flag 化，关 = 回上一步） */
export const DEFAULT_GL_FLAGS: GLFlags = {
  glBase: true,
  artDir: 'deep',
  glSpheres: false,
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

  return result;
}
