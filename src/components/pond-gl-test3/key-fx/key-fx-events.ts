import { triggerKeyFx, type KeyFxDetail } from './key-fx-state';

export const KEY_FX_EVENT = 'jam:key-fx';
export type { KeyFxDetail } from './key-fx-state';

/** 合奏输入唯一视觉总线：先写统一脉冲池，再广播给需要瞬时事件的水面消费者。 */
export function emitKeyFx(key: string): void {
  const detail: KeyFxDetail = triggerKeyFx(key);
  window.dispatchEvent(new CustomEvent<KeyFxDetail>(KEY_FX_EVENT, { detail }));
  if (detail.family && detail.x != null && detail.y != null) {
    window.dispatchEvent(new CustomEvent('bg-ripple:wave', { detail: {
      x: detail.x * window.innerWidth,
      y: (1 - detail.y) * window.innerHeight,
      size: detail.size,
      duration: detail.duration,
      // 高度场由统一行为时间轴注入；这里仅让旧球体/花瓣消费者收到同一因果事件。
      strength: 0,
      petalStrength: detail.petalStrength,
    } }));
  }
}
