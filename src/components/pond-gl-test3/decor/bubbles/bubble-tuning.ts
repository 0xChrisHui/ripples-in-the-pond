/**
 * P20 池塘气泡调参（程序化单例，范式同 sphere-tuning / ripple-tuning）。
 * 调参面板写、每帧 useFrame 直读，不触发 React 重渲染。
 */
export interface BubbleTuning {
  size: number;     // 气泡大小倍率
  opacity: number;  // 亮度倍率（峰值基准见 PondBubbles：低于球高光）
  speed: number;    // 上升速度倍率
  interval: number; // 串与串间隔倍率
  count: number;    // 每串最多个数（下限固定 3）
}

export const DEFAULT_BUBBLE_TUNING: BubbleTuning = { size: 1, opacity: 1, speed: 1, interval: 1, count: 6 };

let current: BubbleTuning = { ...DEFAULT_BUBBLE_TUNING };

export function getBubbleTuning(): BubbleTuning {
  return current;
}
export function setBubbleTuning(patch: Partial<BubbleTuning>): void {
  current = { ...current, ...patch };
}
export function resetBubbleTuning(): void {
  current = { ...DEFAULT_BUBBLE_TUNING };
}
