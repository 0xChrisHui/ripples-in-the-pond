/** P20 气泡模拟的共用类型与小工具（bubble-sim / bubble-chain 共享，保持单文件 ≤220 行）。 */
import type { Disc } from './bubble-env';
import type { BubbleTuning } from '../bubble-tuning';
import type { CarrierPort } from '../bubble-bridge';

export type Rng = () => number;
export const between = (r: Rng, lo: number, hi: number) => lo + (Math.max(hi, lo) - lo) * r();

export interface BubbleView {
  x: number; y: number;  // 屏幕像素
  radius: number;        // 光环半径（像素）
  alpha: number;         // 0..1，含淡入淡出与避让淡出
  depth: number;         // 0 池底 → 1 水面（外观：越深越小越软越淡）
}

export interface Bubble {
  delay: number; rise: number; dwell: number; size: number; sway: number; freq: number; phase: number;
  popped: boolean;
  carrier: boolean; carrierId: number; held: number; // 载体泡：到水面后停住，等手记宿主放行再破
}
/** 一组气泡：同一个水面落点、若干泡依次升起。retired = 已收尾（不再放出还没开始的泡，现有的升完即止）。 */
export interface Chain { t: number; ax: number; ay: number; end: number; bubbles: Bubble[]; fromBurst: boolean; retired: boolean }

export type BurstKind = 'plain' | 'note';
/** 控制台"立即"请求的结果：本帧刚开始 / 没有空位（已满或避让找不到位置）；每帧读完即清空。 */
export type BurstResult = 'started' | 'failed' | null;

export interface SimEnv {
  w: number; h: number;
  discs: ReadonlyArray<Disc>; discCount: number;
  surfaceD: number;       // 有效水位（球 z 域的 d）
  playing: boolean;       // 日蚀期间：平均组数乘 playingGroupsMult
  reduced: boolean;       // 减弱动效：不生成
  tuning: BubbleTuning;
  carrier?: CarrierPort;  // 无宿主 / 不出手记时不传
  burst?: BurstKind | null; // 控制台"立即冒一串 / 出手记"（本帧新请求）
  onPop: (x: number, y: number) => void; // 泡在水面停完、破掉的瞬间（屏幕像素）；球挡住时不触发
}
