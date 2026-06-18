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
  bobAmp: number;     // H5 球自漂浮沉幅度（z 单位；0=不自漂）
  bobScale: number;   // H5 球自漂频率倍率（×lw 基频；越大越快）
  focusMargin: number;// H5 播放球浮出水面的露出量（越大越高越清晰）
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
  pondFloorStrength: number; // K10 塘底暗纹强度（极淡冷暗增量；只加微妙纵深，不破"水下不压黑"——默认/上限都很小）
  moonReflectStrength: number; // K11 月光倒影强度（≤0.5 克制；偏画面一侧、低不透明 → 氛围点睛、不盖过球）
  pondFloorStyle: number; // K10 塘底花纹（0 细沙偏亮 / 1 彩晕偏彩 / 2 鹅卵石 / 3 沙纹 / 4 矿脉微光）
  perspStrength: number; // K12 一点透视强度（柱顶按离中心距离径向外斜；0=纯俯视，越大边缘柱越斜出露身）
  colCount: number;      // K12 标尺柱数量（0–1 映射可见柱数；偏边缘撒点、稀疏不抢球）
  colHeight: number;     // K12 柱高倍率（×逐柱随机高）
  colWidth: number;      // K12 柱宽倍率（×逐柱随机半宽；细柱）
  colOpacity: number;    // K12 柱最大不透明度（石晶共用，退让不抢球）
}

export const DEFAULT_RIPPLE_TUNING: RippleTuning = {
  damping: 0.995,
  refract: 0.6,
  dropMove: 0.008, // K2：划水改路径插值后单笔落多滴 → 调小单滴强度，免快划过强
  dropClick: 0.16,
  dropRadius: 0.05,
  specular: 0.5,
  trail: 0.1,
  splash: 0.2,
  ambient: 0.008,
  bobAmp: 0.08,
  bobScale: 1,
  focusMargin: 0.06,
  pondDepth: 0.5,
  refrExp: 1.4,
  moonExp: 1.2,
  shadowStrength: 0.2,
  shadowHeight: 1.2,
  causticsStrength: 0.4,
  zoomAmount: 0.4,
  motesCount: 0.4,   // 稀疏-中等：~0.4·MAX 颗，柔光不喧宾夺主
  motesSize: 2.0,    // 细小光点
  motesOpacity: 0.6, // 半透，退让衬托
  motesDrift: 0.15,  // 轻柔游走（缩放为主、漂移克制）
  plantsCount: 0.42, // 稍密：~0.42·MAX 片睡莲，成"浮叶"而非零碎，仍留白不挡球
  plantsSize: 0.09,  // 放大圆片（NDC 半径，逐叶随机 0.6×–1.4×）→ 读成叶不读成碎片
  plantsOpacity: 0.62,// 提亮半透墨绿，暗塘上可辨、仍退让
  plantsSway: 0.2,   // 涟漪轻晃（沉静——比微光更小、几乎静止只微摇）
  pondFloorStrength: 0.05, // 极淡暗纹：默认 0.05（面板 0–0.2），只给一丝纵深、绝不压亮整体
  moonReflectStrength: 0.4, // 月华倒影：默认 0.4（面板 0–1），安静优雅的一道冷白、点睛不抢球
  pondFloorStyle: 0, // 默认细沙偏亮（面板 5 选 1）
  perspStrength: 0.18, // 透视：轻为主（面板 0–0.6），免和俯视的平球违和
  colCount: 0.5,       // ~32 柱，偏边缘稀疏
  colHeight: 1.0,      // 柱高倍率（面板 0.3–2）
  colWidth: 1.0,       // 柱宽倍率（面板 0.3–2，细柱）
  colOpacity: 0.7,     // 柱不透明度（面板 0–1）
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
