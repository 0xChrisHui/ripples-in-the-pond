import type { GlPhysNode } from '@/src/components/pond-gl-test3/spheres/gl-sim-setup';

/**
 * /lens 功能层与球命中层之间的最小桥：功能层挂载时登记回调，命中层只读。
 * 未登记（首页常态）时全部为空，命中层行为与原来完全一致。
 */
export type LensBridge = {
  /** 点击 / 轻点球。返回 true 表示已消费（例如手机上第一次点击只选中），命中层不再播放。 */
  activate?: (node: GlPhysNode, via: 'mouse' | 'touch' | 'key') => boolean;
  /** 键盘焦点进入 / 离开球（Tab 聚焦 = 光圈照到它）。 */
  focus?: (node: GlPhysNode | null) => void;
};

let bridge: LensBridge = {};

export function setLensBridge(next: LensBridge): void { bridge = next; }
export function getLensBridge(): LensBridge { return bridge; }
