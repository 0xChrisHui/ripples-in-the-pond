/** v39/v86/v87 — 假 3D effects 配置中心。每个 effect 是布尔开关，URL 参数同步。 */

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
  gradientGlow: boolean;     // v87 — 球光晕渲染方案：false=SVG filter（A，原版）/ true=radial gradient（C，省 GPU）
  viewportCull: boolean;     // v87 — 视口外的球设 display:none，省合成成本（J 方案，缩放时收益最大）
  adaptiveQuality: boolean;  // v87 — FPS 持续过低时自动按降级表关效果，恢复后慢慢加回（L 方案）

  // ===== Phase 8 — 水塘视觉重设计（新 flag 桌面/移动默认全 false，沙盒先行）=====
  // Wave 0（主会话）
  hoverRipple: boolean;      // §2.14 hover 入水反馈：指尖掠过球生一圈小涟漪
  // --- Lane A 球体线 ---（waterRipple / waterDrop / bobbing / dropShimmer / sphereSheen）
  // --- Lane B 环境线 ---（caustics / filmGrain / pondLights / drops / pondShadow / skyReflection / moonPath / pondEdge / rain）
  // --- Lane C 物理线 ---（springBack / viscous / breeze）
  // --- Lane D 音频线 ---（audioPulse / beatRipple / echoRipple / playWaves / bubbles / lightFollow）
  // --- Lane E 编排线 ---（waterWake / dragWake / waterMoon / groupWave / navPond / tide / clickSplash / cursorRing / splashIntro）
}

/** v87 桌面：10 个 effect 全开 + gradientGlow 默认关闭（= 用原 SVG filter 看视觉基准） */
export const DESKTOP_EFFECTS: EffectsConfig = {
  focus: true,
  tilt: true,
  perspective: true,
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
  // --- Lane B 环境线 ---
  // --- Lane C 物理线 ---
  // --- Lane D 音频线 ---
  // --- Lane E 编排线 ---
};

/**
 * v87 手机：仅保留 4 个氛围 effect（comet / stars / aurora / bgRipples），
 * 关掉 6 个交互/几何 effect（focus / tilt / perspective / sphereRipple / layerWave2 / fog）。
 *
 * 取舍依据：tilt 无鼠标即不工作；perspective + focus + layerWave2 在小屏幕收益小；
 * 氛围 4 个无关交互、视觉收益不随屏幕缩水。
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

  // ===== Phase 8（沙盒：移动默认全 false；S8/F9 拍板"最小水塘集"前一律 false）=====
  hoverRipple: false,     // Wave 0
  // --- Lane A 球体线 ---
  // --- Lane B 环境线 ---
  // --- Lane C 物理线 ---
  // --- Lane D 音频线 ---
  // --- Lane E 编排线 ---
};

/** 兼容老引用 — Archipelago 兜底 + 桌面默认（设备无关 fallback） */
export const DEFAULT_EFFECTS: EffectsConfig = DESKTOP_EFFECTS;

export interface EffectMeta {
  key: keyof EffectsConfig;
  label: string;
  group: string;
}

export const EFFECTS_META: EffectMeta[] = [
  { key: 'focus', label: '焦平面景深', group: '基础' },
  { key: 'tilt', label: '鼠标视差', group: '基础' },
  { key: 'perspective', label: '一点透视', group: '几何' },
  { key: 'comet', label: '彗星 (C2)', group: '运动' },
  { key: 'sphereRipple', label: '球涟漪', group: '运动' },
  { key: 'layerWave2', label: '层级波动（每 2s 单球）', group: '运动' },
  { key: 'fog', label: '景深雾 (E16)', group: '环境' },
  { key: 'stars', label: '星尘背景 (E17)', group: '环境' },
  { key: 'aurora', label: '极光漫流 (E18)', group: '环境' },
  { key: 'bgRipples', label: '背景白色涟漪', group: '环境' },
  { key: 'gradientGlow', label: '渐变光晕（C方案 / 省 GPU）', group: '渲染' },
  { key: 'viewportCull', label: '视口剔除（J方案 / 缩放时省合成）', group: '渲染' },
  { key: 'adaptiveQuality', label: '自适应品质（L方案 / FPS 低时自动降级）', group: '渲染' },

  // ===== Phase 8 — 水塘视觉（label 中文 + group：运动/环境/渲染）=====
  { key: 'hoverRipple', label: 'hover 入水涟漪', group: '运动' },
  // --- Lane A 球体线 ---
  // --- Lane B 环境线 ---
  // --- Lane C 物理线 ---
  // --- Lane D 音频线 ---
  // --- Lane E 编排线 ---
];

/**
 * v87 — base 参数允许调用方传入设备相关的"基线"（DESKTOP_EFFECTS / MOBILE_EFFECTS）。
 * 不传时回落到 DEFAULT_EFFECTS（= 桌面），保持老调用兼容。
 */
export function parseEffectsFromURL(
  searchParams: URLSearchParams,
  base: EffectsConfig = DEFAULT_EFFECTS,
): EffectsConfig {
  const result = { ...base };
  for (const key of Object.keys(base) as Array<keyof EffectsConfig>) {
    const v = searchParams.get(key);
    if (v === '1' || v === 'true') result[key] = true;
    else if (v === '0' || v === 'false') result[key] = false;
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
      params.set(key, effects[key] ? '1' : '0');
    }
  }
  return params.toString();
}
