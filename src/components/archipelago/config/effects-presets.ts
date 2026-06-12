/**
 * effects 预设值（从 effects-config.ts 拆出，控行数）。
 * DESKTOP/MOBILE 设备基线 + DEFAULT 兜底。新 flag 在各 lane 标记块内追加。
 */
import type { EffectsConfig } from '../effects-config';

/** v87 桌面：10 个 effect 全开 + gradientGlow 默认关闭（= 用原 SVG filter 看视觉基准）。
 *  Phase 8 新 flag 一律默认 false（沙盒先行）。 */
export const DESKTOP_EFFECTS: EffectsConfig = {
  focus: true,
  tilt: true,
  perspective: true,     // P8-B S3 拟改 false（弱化 3D），但属"默认视觉变化"→ 留 S8 拍板；现保持现状
                          // /test 用 ?perspective=0 体验关闭效果
  comet: true,
  sphereRipple: true,
  layerWave2: true,
  fog: true,
  stars: true,
  aurora: true,
  bgRipples: true,
  gradientGlow: false,    // C — 用户偏爱原 SVG filter 视觉，不默认开
  viewportCull: true,     // J — 默认开（zoom 下省合成成本，无 zoom 时零开销）
  adaptiveQuality: true,  // L — 默认开（FPS 低时自动降级保下限；console 有日志可见）

  // ===== Phase 8（沙盒：桌面默认全 false）=====
  hoverRipple: false,     // Wave 0
  // --- Lane A 球体线 ---
  waterRipple: false,
  waterDrop: false,
  bobbing: false,
  dropShimmer: false,
  sphereSheen: false,
  // --- Lane B 环境线 ---
  caustics: false,
  filmGrain: false,
  pondLights: false,
  drops: false,
  pondShadow: false,
  skyReflection: false,
  moonPath: false,
  pondEdge: false,
  rain: false,
  // --- Lane C 物理线 ---
  springBack: false,
  viscous: false,
  breeze: false,
  // --- Lane D 音频线 ---
  audioPulse: false,
  beatRipple: false,
  echoRipple: false,
  playWaves: false,
  bubbles: false,
  lightFollow: false,
  // --- Lane E 编排线 ---
  waterWake: false,
  dragWake: false,
  waterMoon: false,
  groupWave: false,
  navPond: false,
  tide: false,
  clickSplash: false,
  cursorRing: false,
  splashIntro: false,

  waterRippleScale: 12,   // Lane A — 非布尔：水波 displacement 强度（0-30，/test slider 调）
};

/**
 * v87 手机：仅保留 4 个氛围 effect（comet / stars / aurora / bgRipples）。
 * Phase 8 新 flag 一律默认 false（S8/F9 拍板"最小水塘集"前）。
 */
export const MOBILE_EFFECTS: EffectsConfig = {
  focus: false,
  tilt: false,
  perspective: false,
  comet: true,
  sphereRipple: false,
  layerWave2: false,
  fog: false,
  stars: true,
  aurora: true,
  bgRipples: true,
  gradientGlow: false,
  viewportCull: true,
  adaptiveQuality: true,

  // ===== Phase 8（移动默认全 false）=====
  hoverRipple: false,
  // --- Lane A 球体线 ---
  waterRipple: false,
  waterDrop: false,
  bobbing: false,
  dropShimmer: false,
  sphereSheen: false,
  // --- Lane B 环境线 ---
  caustics: false,
  filmGrain: false,
  pondLights: false,
  drops: false,
  pondShadow: false,
  skyReflection: false,
  moonPath: false,
  pondEdge: false,
  rain: false,
  // --- Lane C 物理线 ---
  springBack: false,
  viscous: false,
  breeze: false,
  // --- Lane D 音频线 ---
  audioPulse: false,
  beatRipple: false,
  echoRipple: false,
  playWaves: false,
  bubbles: false,
  lightFollow: false,
  // --- Lane E 编排线 ---（cursorRing 移动端无意义，全部 false）
  waterWake: false,
  dragWake: false,
  waterMoon: false,
  groupWave: false,
  navPond: false,
  tide: false,
  clickSplash: false,
  cursorRing: false,
  splashIntro: false,

  waterRippleScale: 12,
};

/** 兼容老引用 — Archipelago 兜底 + 桌面默认（设备无关 fallback） */
export const DEFAULT_EFFECTS: EffectsConfig = DESKTOP_EFFECTS;
