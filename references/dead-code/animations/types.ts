import type Two from 'two.js';

/**
 * 单个动画的运行实例 — 由 EffectFactory 在 stage 上构建
 */
export interface AnimationEffect {
  /** 触发键（小写字母，e.g. 'b' for corona） */
  key: string;
  /** 名字（用于调试 / 日后 UI 展示） */
  name: string;
  /** 触发动画 */
  start: () => void;
  /** 停止 + 复位（视情况实现） */
  reset?: () => void;
  /** 容器 resize 时调（让动画重算 center / radius）*/
  onResize?: () => void;
}

export type EffectFactory = (stage: Two) => AnimationEffect;
