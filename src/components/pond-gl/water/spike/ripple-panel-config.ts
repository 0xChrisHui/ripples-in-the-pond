import type { RippleTuning } from './ripple-tuning';

/**
 * RippleSpikePanel 的滑块分组定义（从面板抽出腾行数；面板只管渲染 + 保存/重置）。
 * 每组 = 一个标题段下的若干滑块；面板按 GROUPS 顺序渲染。
 */
export type Slider = { key: keyof RippleTuning; label: string; min: number; max: number; step: number };

const RIPPLE: ReadonlyArray<Slider> = [
  { key: 'damping', label: '阻尼(持续)', min: 0.95, max: 0.999, step: 0.001 },
  { key: 'refract', label: '折射强度', min: 0, max: 3, step: 0.05 },
  { key: 'dropMove', label: '滴水·移动', min: 0, max: 0.05, step: 0.001 },
  { key: 'dropClick', label: '滴水·点击', min: 0, max: 0.4, step: 0.005 },
  { key: 'dropRadius', label: '滴水半径', min: 0.01, max: 0.15, step: 0.005 },
  { key: 'specular', label: '高光', min: 0, max: 1.5, step: 0.02 },
  { key: 'trail', label: '拖尾强度', min: 0, max: 0.4, step: 0.005 },
  { key: 'splash', label: '溅起强度', min: 0, max: 0.5, step: 0.005 },
  { key: 'ambient', label: '常驻微波', min: 0, max: 0.06, step: 0.002 },
];

const MOTION: ReadonlyArray<Slider> = [
  { key: 'waveAmpMin', label: '浮动幅度·下限', min: 0, max: 0.5, step: 0.01 }, // 球浮动：单次沉浮幅度区间（每次随机取）
  { key: 'waveAmpMax', label: '浮动幅度·上限', min: 0, max: 0.6, step: 0.01 },
  { key: 'waveSpeedMin', label: '浮动速度·下限', min: 0.2, max: 4, step: 0.05 }, // 越大越快=时长越短
  { key: 'waveSpeedMax', label: '浮动速度·上限', min: 0.2, max: 4, step: 0.05 },
  { key: 'bobScale', label: '触发频率', min: 0.2, max: 3, step: 0.1 },          // 多久有一颗球开始波动
  { key: 'focusMargin', label: '焦点露出', min: 0, max: 0.2, step: 0.005 },     // 播放球浮出量（与波动正交）
  { key: 'wheelSens', label: '滚轮灵敏度', min: 0.1, max: 2, step: 0.05 },
];

const DRIFT: ReadonlyArray<Slider> = [
  { key: 'drift', label: '飘动幅度', min: 0, max: 0.6, step: 0.01 },
  { key: 'wavePush', label: '涟漪推力', min: 0, max: 8, step: 0.1 },
  { key: 'wavePushDepth', label: '推力衰减深', min: 0.1, max: 1, step: 0.02 },
];

const DEPTH: ReadonlyArray<Slider> = [
  { key: 'pondDepth', label: '塘深', min: 0.1, max: 1, step: 0.02 },
  { key: 'refrExp', label: '折射·深度指数', min: 0.3, max: 3, step: 0.1 },
  { key: 'moonExp', label: '月光·深度指数', min: 0.3, max: 3, step: 0.1 },
];

const SHADOW: ReadonlyArray<Slider> = [
  { key: 'shadowStrength', label: '投影强度', min: 0, max: 1, step: 0.02 },
  { key: 'shadowHeight', label: '投影高度感', min: 0, max: 2.5, step: 0.05 },
];

const MOTES: ReadonlyArray<Slider> = [
  { key: 'motesCount', label: '微光密度', min: 0, max: 1, step: 0.02 },
  { key: 'motesSize', label: '微光点径', min: 0.5, max: 6, step: 0.1 },
  { key: 'motesOpacity', label: '微光透明', min: 0, max: 1, step: 0.02 },
  { key: 'motesDrift', label: '微光游走', min: 0, max: 1, step: 0.02 },
];

const PLANTS: ReadonlyArray<Slider> = [
  { key: 'plantsCount', label: '睡莲密度', min: 0, max: 1, step: 0.02 },
  { key: 'plantsSize', label: '睡莲大小', min: 0.02, max: 0.14, step: 0.005 },
  { key: 'plantsOpacity', label: '睡莲透明', min: 0, max: 1, step: 0.02 },
  { key: 'plantsSway', label: '睡莲轻晃', min: 0, max: 1, step: 0.02 },
];

const MOONBALL: ReadonlyArray<Slider> = [
  { key: 'ballLightAbove', label: '水上球衰减', min: 0, max: 1, step: 0.02 },
  { key: 'ballLightBelow', label: '水下球衰减', min: 0, max: 1, step: 0.02 },
  { key: 'waveOnBall', label: '水下球波纹', min: 0, max: 1.5, step: 0.05 },
];

const COLUMNS: ReadonlyArray<Slider> = [
  { key: 'perspStrength', label: '透视强度', min: 0, max: 0.6, step: 0.01 },
  { key: 'colCount', label: '柱数量', min: 0, max: 1, step: 0.02 },
  { key: 'colHeight', label: '柱高', min: 0.3, max: 2, step: 0.05 },
  { key: 'colWidth', label: '柱宽', min: 0.3, max: 2, step: 0.05 },
  { key: 'colOpacity', label: '柱透明', min: 0, max: 1, step: 0.02 },
];

const PETAL: ReadonlyArray<Slider> = [
  { key: 'petalCount', label: '花瓣数量', min: 0, max: 40, step: 1 },
  { key: 'petalSize', label: '花瓣大小', min: 0.3, max: 3, step: 0.05 },
  { key: 'petalSens', label: '花瓣灵敏度', min: 0, max: 3, step: 0.05 }, // 各种运动幅度倍率
  { key: 'petalDrag', label: '触发·划水', min: 0, max: 3, step: 0.05 },   // 各来源对花瓣的触发强度倍率（0=该来源不影响）
  { key: 'petalClick', label: '触发·点击', min: 0, max: 3, step: 0.05 },
  { key: 'petalWave', label: '触发·背景涟漪', min: 0, max: 3, step: 0.05 },
  { key: 'petalSplash', label: '触发·球出入水', min: 0, max: 3, step: 0.05 },
];

/** 单滑块组：caustics/zoom/pondFloor/moonReflect 各只一个滑块，内联即可。 */
const CAUSTICS: ReadonlyArray<Slider> = [{ key: 'causticsStrength', label: '焦散强度', min: 0, max: 1, step: 0.02 }];
const ZOOM: ReadonlyArray<Slider> = [{ key: 'zoomAmount', label: '缩放幅度', min: 0, max: 4, step: 0.05 }];
const PONDFLOOR: ReadonlyArray<Slider> = [{ key: 'pondFloorStrength', label: '塘底浓度', min: 0, max: 1, step: 0.02 }];
const MOONREFLECT: ReadonlyArray<Slider> = [{ key: 'moonReflectStrength', label: '月光倒影', min: 0, max: 1, step: 0.02 }];

/** 普通分组（标题 + 滑块）按此顺序渲染。PONDFLOOR(含花纹按钮) 在面板里单独插。 */
export const SLIDER_GROUPS: ReadonlyArray<{ title: string; sliders: ReadonlyArray<Slider> }> = [
  { title: '波纹', sliders: RIPPLE },
  { title: '运动（球浮动）', sliders: MOTION },
  { title: '球飘动+涟漪推（需开开关）', sliders: DRIFT },
  { title: '深度模型（K3，需开开关）', sliders: DEPTH },
  { title: '球投影（K4，需开开关）', sliders: SHADOW },
  { title: '月光焦散（K5，需开开关）', sliders: CAUSTICS },
  { title: '水面缩放（K6，需开开关）', sliders: ZOOM },
  { title: '漂浮微光（K8，需开开关）', sliders: MOTES },
  { title: '水生植物（K9，需开开关）', sliders: PLANTS },
];

/** PONDFLOOR 之后的分组（花纹按钮插在 PONDFLOOR 与这些之间）。 */
export const SLIDER_GROUPS_TAIL: ReadonlyArray<{ title: string; sliders: ReadonlyArray<Slider> }> = [
  { title: '月光倒影（K11，需开开关）', sliders: MOONREFLECT },
  { title: '月光·对球增亮(衰减)', sliders: MOONBALL },
  { title: '水位标尺柱（K12，需开开关）', sliders: COLUMNS },
  { title: '水面花瓣（需开开关）', sliders: PETAL },
];

export const PONDFLOOR_SLIDERS = PONDFLOOR;
