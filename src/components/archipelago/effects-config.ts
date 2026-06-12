/** v39/v86/v87 — 假 3D effects 配置中心。每个 effect 是布尔开关，URL 参数同步。
 *  P8 flag 膨胀后拆分：预设值 → config/effects-presets.ts；面板元数据 → config/effects-meta.ts；
 *  本文件保留接口 + URL 解析/序列化，并 re-export 另两份（旧 import 路径 './effects-config' 不变）。 */

export interface EffectsConfig {
  focus: boolean;
  tilt: boolean;
  perspective: boolean;
  comet: boolean;
  sphereRipple: boolean;
  layerWave2: boolean;  // v86 事件驱动：每 2s 单球钟形 sin(πt) 8-12s 归位
  fog: boolean;
  stars: boolean;
  aurora: boolean;
  bgRipples: boolean;
  gradientGlow: boolean;     // v87 — 球光晕渲染：false=SVG filter（A，原版）/ true=radial gradient（C，省 GPU）
  viewportCull: boolean;     // v87 — 视口外的球设 display:none，省合成成本（J 方案）
  adaptiveQuality: boolean;  // v87 — FPS 持续过低时自动按降级表关效果（L 方案）

  // ===== Phase 8 — 水塘视觉重设计（新 flag 桌面/移动默认全 false，沙盒先行）=====
  hoverRipple: boolean;      // Wave 0 §2.14 hover 入水反馈
  // --- Lane A 球体线 ---
  waterRipple: boolean;      // 8-A 水波折射（feDisplacementMap）
  waterDrop: boolean;        // §2.3 水珠质感（中心透边缘深 + 高光 + rim）
  bobbing: boolean;          // §2.18 浮沉呼吸（多频异相）
  dropShimmer: boolean;      // F1 水珠主高光呼吸（前置 waterDrop）
  sphereSheen: boolean;      // F5 球面流光（高危，前置 waterDrop）
  // --- Lane B 环境线 ---
  caustics: boolean;         // §2.7 水焦散网纹（aurora 替身）
  filmGrain: boolean;        // §2.17 胶片颗粒（全屏静态 overlay）
  pondLights: boolean;       // §2.8 浮光 + 水面碎光（stars 替身）
  drops: boolean;            // §2.10 落滴（触水推球+画圈）
  pondShadow: boolean;       // §2.12 浮影暗斑（尺度参照物）
  skyReflection: boolean;    // F3 星空倒影（旧 stars 倒进水里）
  moonPath: boolean;         // F3 月光水路（MOON_ANCHOR 派生竖直光带）
  pondEdge: boolean;         // F1 塘岸暗缘（全屏静态羽化暗角）
  rain: boolean;             // F4 细雨（drops 强化档）
  // --- Lane C 物理线 ---
  springBack: boolean;       // C3 受扰回摆（欠阻尼弹簧）
  viscous: boolean;          // C5 黏滞水化（d3 参数切换）
  breeze: boolean;           // F4 风过水面（碎光带 + 同向微力）
  // --- Lane D 音频线 ---
  audioPulse: boolean;       // C1 播放球/月亮随低频能量呼吸脉动
  beatRipple: boolean;       // C1 强拍以播放球为中心荡开离散涟漪
  echoRipple: boolean;       // F2 播放开始声音传到最近 4-6 球
  playWaves: boolean;        // F2 播放球处同心声波环连续扩散
  bubbles: boolean;          // F2 播放中气泡升腾
  lightFollow: boolean;      // F2 环境月光斑向播放球偏移（降级订阅者）
  // --- Lane E 编排线 ---
  waterWake: boolean;        // §2.9 水痕：抽象掠水扰动 + 推球
  dragWake: boolean;         // §2.16 拖拽水痕（与 waterWake 共享池）
  waterMoon: boolean;        // §2.15 水中月（替日食"挂天上"）
  groupWave: boolean;        // E2 切组涟漪（从标签侧扫过）
  navPond: boolean;          // E3 顶栏水塘化（引 --pond-* token，默认零变化）
  tide: boolean;             // F1 潮汐呼吸（球群独立 wrapper g 极缓 scale）
  clickSplash: boolean;      // F1 点击水花（播放瞬间球心迸光点）
  cursorRing: boolean;       // F5 指尖涟漪（椭圆环延迟跟随鼠标）
  splashIntro: boolean;      // E1 入场编排（依赖 Lane A bobbing 内层 g，留 Wave 2）

  waterRippleScale: number;  // Lane A 非布尔：水波 displacement 强度（0-30，/test slider）
}

/** 值为 boolean 的 flag key（排除 waterRippleScale），URL 解析/预设遍历用 */
export type BooleanEffectKey = {
  [K in keyof EffectsConfig]: EffectsConfig[K] extends boolean ? K : never;
}[keyof EffectsConfig];

// 旧引用路径不变：从本文件 re-export 预设与元数据
export { DESKTOP_EFFECTS, MOBILE_EFFECTS, DEFAULT_EFFECTS } from './config/effects-presets';
export { EFFECTS_META, type EffectMeta } from './config/effects-meta';

import { DEFAULT_EFFECTS } from './config/effects-presets';

/**
 * v87 — base 参数允许调用方传入设备相关基线（DESKTOP_EFFECTS / MOBILE_EFFECTS）。
 * waterRippleScale 是唯一的数值 flag，单独按数字解析；其余按布尔。
 */
export function parseEffectsFromURL(
  searchParams: URLSearchParams,
  base: EffectsConfig = DEFAULT_EFFECTS,
): EffectsConfig {
  const result = { ...base };
  for (const key of Object.keys(base) as Array<keyof EffectsConfig>) {
    const v = searchParams.get(key);
    if (v === null) continue;
    if (key === 'waterRippleScale') {
      const n = Number(v);
      if (!Number.isNaN(n)) result.waterRippleScale = n;
      continue;
    }
    if (v === '1' || v === 'true') result[key] = true as never;
    else if (v === '0' || v === 'false') result[key] = false as never;
  }
  return result;
}

/** 仅把"非 base 值"写进 query，URL 短一些 */
export function effectsToQuery(
  effects: EffectsConfig,
  base: EffectsConfig = DEFAULT_EFFECTS,
): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(effects) as Array<keyof EffectsConfig>) {
    if (effects[key] !== base[key]) {
      const val = effects[key];
      params.set(key, typeof val === 'number' ? String(val) : val ? '1' : '0');
    }
  }
  return params.toString();
}
