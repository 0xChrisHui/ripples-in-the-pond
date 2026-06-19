'use client';

/**
 * 波纹/运动参数 store（H1 spike 起，H6 升格为 H 线统一"波纹/运动参数板"后端，范式同 sphere-tuning）。
 *
 * 单例 + pub/sub + localStorage。WaterDistort/RttSpike 每帧读 getRippleTuning() 写 ripple uniform；
 * sphere-motion 读 bobAmp/bobScale/focusMargin 算球浮沉；RippleSpikePanel 用 useSyncExternalStore 订阅渲染滑块。
 * H6 收尾：spike 文件正式化挪进 overlay/ 的 cleanup 留作后续（不影响功能）。
 */
export interface RippleTuning {
  damping: number;    // sim 阻尼（越大涟漪持续越久；0.995 起）
  refract: number;    // 折射强度（位移 ∝ 高度梯度×此值，clamp 上限；旧 perturb 改名换标度，老存档自动回默认）
  dropMove: number;   // 滴水强度·鼠标移动
  dropClick: number;  // 滴水强度·点击
  dropRadius: number; // 滴水半径（占屏比）
  specular: number;   // 月光高光强度
  trail: number;      // H4 拖球尾迹强度（被拖的球留下的水痕）
  splash: number;     // H4 球穿过水面溅起强度
  ambient: number;    // H4 常驻微波强度（塘面始终有细腻波动；0=关）
  bobAmp: number;     // （旧 H5 浮沉幅度；球浮动已改区间 waveAmp*，此字段不再用）
  bobScale: number;   // 球浮动：波动**触发频率**（越大越频繁有球开始波动）
  focusMargin: number;// 播放球浮出水面的露出量（越大越高越清晰；焦点，与波动正交）
  waveAmpMin: number; // 球浮动：单次沉浮**幅度下限**（=尺寸倍率偏移；每次波动在[min,max]随机取 → 更多元）
  waveAmpMax: number; // 单次沉浮幅度上限
  waveSpeedMin: number; // 球浮动：单次沉浮**速度下限**（越大越快=时长越短；时长=10s/speed。每次在[min,max]随机取）
  waveSpeedMax: number; // 单次沉浮速度上限
  pondDepth: number;  // K3 塘深：深度因子 d 的归一分母（越小越快到"最深"）
  refrExp: number;    // K3 折射随深度的指数 a（折射 ∝ d^a，近轻深重；越大近处越清晰）
  moonExp: number;    // K3 月光随深度的指数 b（月光 ∝ (1−d)^b，近强深弱）
  shadowStrength: number; // K4 空中球水面投影最大压暗量（0=无影；越大影越深）
  shadowHeight: number;   // K4 高度对投影的影响增益（越大：高/低层级球的影差异越显——偏移/半影/模糊/衰减更随高度）
  causticsStrength: number; // K5 月光焦散光照总强度（0=无光；越大水面流光越亮）
  zoomAmount: number; // K6 水面缩放幅度（zoom=1+(水位−0.5)·此值；0=不缩，0.4 时水位 0→1 约 0.8×→1.2×）
  motesCount: number;   // K8 微光密度（0–1 归一，映射粒子数；越大点越多）
  motesSize: number;    // K8 微光点径（屏幕像素，sizeAttenuation 关 → 与缩放无关、只随此值）
  motesOpacity: number; // K8 微光最大不透明度（≤1，克制免抢球）
  motesDrift: number;   // K8 游走幅度（轻柔漂移强度；缩放为主、漂移克制——默认小，免糊掉缩放感）
  plantsCount: number;  // K9 睡莲叶密度（0–1 归一，映射叶片数；稀疏留白、不挡球）
  plantsSize: number;   // K9 叶片基准半径（NDC 比例，逐叶随机微差；俯视圆片大小）
  plantsOpacity: number;// K9 叶片最大不透明度（≤1，半透墨绿，退让不盖球）
  plantsSway: number;   // K9 涟漪轻晃幅度（伪光流摇曳；克制——比 K8 更沉静、运动更小）
  pondFloorStrength: number; // K10 亮底 mix 浓度（0–1：暗塘底→塘底花纹的替换量；越大花纹越亮越显，球受亮度阈值保护不被覆盖）
  moonReflectStrength: number; // K11 月光倒影强度（≤0.5 克制；偏画面一侧、低不透明 → 氛围点睛、不盖过球）
  ballLightAbove: number; // 月光(焦散/倒影取高者·无涟漪环境光)对"水上球"的增亮衰减 0..1（独立于强度）
  ballLightBelow: number; // 月光对"水下球"的增亮衰减 0..1
  waveOnBall: number;     // 水下球波纹增强：水面涟漪明暗乘性荡漾过水下球面，提升水下感（0=关）
  pondFloorStyle: number; // K10 塘底花纹（0 暗矿 / 1 亮沙 / 2 虹彩 / 3 莲花 / 4 星河）
  perspStrength: number; // K12 一点透视强度（柱顶按离中心距离径向外斜；0=纯俯视，越大边缘柱越斜出露身）
  colCount: number;      // K12 标尺柱数量（0–1 映射可见柱数；偏边缘撒点、稀疏不抢球）
  colHeight: number;     // K12 柱高倍率（×逐柱随机高）
  colWidth: number;      // K12 柱宽倍率（×逐柱随机半宽；细柱）
  colOpacity: number;    // K12 柱最大不透明度（石晶共用，退让不抢球）
  drift: number;         // 新效果 球随机飘动幅度（每帧注入游走速度的强度；0=不漂）
  wavePush: number;      // 新效果 点击涟漪推水下球的推力倍率（0=不推）
  wavePushDepth: number; // 新效果 推力随深度衰减的深度（归一层；球离水面这么深→推力≈0，越小衰减越快）
  wheelSens: number;     // 滚轮控水位灵敏度倍率（1=现状基准 0.0008/notch；越小越钝越好微调，触屏捏合同步缩放）
  petalCount: number;    // 水面花瓣数量（整数取整；0=无）
  petalSize: number;     // 水面花瓣大小倍率（×基准；含投影）
  petalSens: number;     // 水面花瓣灵敏度（各种运动幅度倍率：随波漂/起伏/旋转/轻摇；0=几乎静止）
  petalDrag: number;     // 花瓣触发·划水/移动 强度倍率（1=默认，0=不影响）
  petalClick: number;    // 花瓣触发·点击 强度倍率
  petalWave: number;     // 花瓣触发·背景/导航涟漪(bg-ripple:wave) 强度倍率
  petalSplash: number;   // 花瓣触发·球出入水(穿越水面) 强度倍率
}

// /test1 默认参数组（用户拍板，2026-06-19）：未提到的项保留原默认。
export const DEFAULT_RIPPLE_TUNING: RippleTuning = {
  damping: 0.96,
  refract: 0.8,
  dropMove: 0.016,
  dropClick: 0.1,
  dropRadius: 0.01,
  specular: 0.4,     // 高光
  trail: 0.04,
  splash: 0.15,
  ambient: 0.01,
  bobAmp: 0.08,      // 旧字段，不再用
  bobScale: 1.5,     // 球浮动触发频率
  focusMargin: 0.06, // 未指定，保留
  waveAmpMin: 0.1,   // 球浮动幅度区间下限（=尺寸/层级偏移）
  waveAmpMax: 0.6,   // 球浮动幅度区间上限
  waveSpeedMin: 0.2, // 球浮动速度区间下限（越大越快）
  waveSpeedMax: 0.4, // 球浮动速度区间上限
  pondDepth: 1,
  refrExp: 3,
  moonExp: 3,
  shadowStrength: 0.2, // 未指定，保留
  shadowHeight: 1.2,   // 未指定，保留
  causticsStrength: 0.4,
  zoomAmount: 0.85,  // 水面缩放幅度
  motesCount: 1,
  motesSize: 6,
  motesOpacity: 0.6,
  motesDrift: 1,
  plantsCount: 0.42, // 未指定，保留
  plantsSize: 0.09,
  plantsOpacity: 0.62,
  plantsSway: 0.2,
  pondFloorStrength: 0.7,
  moonReflectStrength: 0.4,
  ballLightAbove: 0.38, // 月光对水上球增亮
  ballLightBelow: 0.16, // 月光对水下球增亮
  waveOnBall: 0.3,      // 水下球波纹增强
  pondFloorStyle: 0,    // 未指定，保留（暗矿）
  perspStrength: 0.18,  // 未指定，保留
  colCount: 0.5,        // 未指定，保留
  colHeight: 1.0,
  colWidth: 1.0,
  colOpacity: 0.7,
  drift: 0.1,          // 球飘动幅度
  wavePush: 1.5,       // 涟漪推力
  wavePushDepth: 0.46, // 推力衰减深
  wheelSens: 0.3,      // 滚轮灵敏度
  petalCount: 7,       // 水面花瓣数量
  petalSize: 0.4,      // 水面花瓣大小
  petalSens: 1.0,      // 水面花瓣灵敏度
  petalDrag: 0.5,      // 花瓣触发·划水
  petalClick: 0.5,     // 花瓣触发·点击
  petalWave: 0.5,      // 花瓣触发·背景涟漪
  petalSplash: 0.2,    // 花瓣触发·球出入水
};

const KEY = 'pond-gl-ripple-spike';

function load(): RippleTuning {
  if (typeof window === 'undefined') return { ...DEFAULT_RIPPLE_TUNING };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_RIPPLE_TUNING };
    return { ...DEFAULT_RIPPLE_TUNING, ...(JSON.parse(raw) as Partial<RippleTuning>) };
  } catch {
    return { ...DEFAULT_RIPPLE_TUNING };
  }
}

let current: RippleTuning = load();
const listeners = new Set<() => void>();

/** shader 侧每帧读（稳定引用，setRippleTuning 才换新对象 → 触发 re-render） */
export function getRippleTuning(): RippleTuning {
  return current;
}

export function setRippleTuning(patch: Partial<RippleTuning>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeRippleTuning(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** "保存"：当前参数写 localStorage，刷新后保留 */
export function saveRippleTuning(): void {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(current));
}

/** 重置为默认并清除已保存值 */
export function resetRippleTuning(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
  setRippleTuning({ ...DEFAULT_RIPPLE_TUNING });
}
