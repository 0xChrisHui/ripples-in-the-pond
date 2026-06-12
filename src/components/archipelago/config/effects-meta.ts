/**
 * effects 面板元数据（从 effects-config.ts 拆出，控行数）。
 * /test 的 EffectsPanel 按 group 分组渲染复选框；新 flag 在各 lane 标记块内追加。
 */
import type { BooleanEffectKey } from '../effects-config';

export interface EffectMeta {
  key: BooleanEffectKey;   // 只列布尔 flag（数值 waterRippleScale 走 slider，不进面板复选框）
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
  { key: 'waterRipple', label: '水波折射（displacement）', group: '环境' },
  { key: 'waterDrop', label: '水珠质感', group: '渲染' },
  { key: 'bobbing', label: '浮沉呼吸（异相）', group: '运动' },
  { key: 'dropShimmer', label: '水珠高光呼吸', group: '渲染' },
  { key: 'sphereSheen', label: '球面流光（高危）', group: '渲染' },
  // --- Lane B 环境线 ---
  { key: 'caustics', label: '水焦散网纹', group: '环境' },
  { key: 'filmGrain', label: '胶片颗粒', group: '环境' },
  { key: 'pondLights', label: '浮光 + 水面碎光', group: '环境' },
  { key: 'drops', label: '落滴（触水生涟漪）', group: '环境' },
  { key: 'pondShadow', label: '浮影暗斑', group: '环境' },
  { key: 'skyReflection', label: '星空倒影', group: '环境' },
  { key: 'moonPath', label: '月光水路', group: '环境' },
  { key: 'pondEdge', label: '塘岸暗缘', group: '环境' },
  { key: 'rain', label: '细雨（drops 强化档）', group: '环境' },
  // --- Lane C 物理线 ---
  { key: 'springBack', label: '受扰回摆（弹簧）', group: '运动' },
  { key: 'viscous', label: '黏滞水化（d3 参数）', group: '运动' },
  { key: 'breeze', label: '风过水面', group: '运动' },
  // --- Lane D 音频线 ---
  { key: 'audioPulse', label: '音频脉动（球/月随低频呼吸）', group: '运动' },
  { key: 'beatRipple', label: '节拍涟漪（强拍荡开）', group: '运动' },
  { key: 'echoRipple', label: '回声涟漪（声传最近球）', group: '运动' },
  { key: 'playWaves', label: '持续声波环', group: '运动' },
  { key: 'bubbles', label: '气泡升腾', group: '运动' },
  { key: 'lightFollow', label: '月光寻声', group: '环境' },
  // --- Lane E 编排线 ---
  { key: 'waterWake', label: '水痕（掠水扰动）', group: '运动' },
  { key: 'dragWake', label: '拖拽水痕', group: '运动' },
  { key: 'waterMoon', label: '水中月', group: '渲染' },
  { key: 'groupWave', label: '切组涟漪', group: '运动' },
  { key: 'navPond', label: '顶栏水塘化', group: '渲染' },
  { key: 'tide', label: '潮汐呼吸', group: '运动' },
  { key: 'clickSplash', label: '点击水花', group: '运动' },
  { key: 'cursorRing', label: '指尖涟漪环', group: '运动' },
  { key: 'splashIntro', label: '入场编排（Wave 2）', group: '运动' },
];
