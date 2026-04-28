/**
 * Phase 6 B2 — 动画注册中心
 *
 * Phase 2 各个 effects/*.ts 在此处导入 + 加进 factories。
 * fire(key) 触发对应动画的 start()。
 */
import type Two from 'two.js';
import type { AnimationEffect, EffectFactory } from './types';
import { createCorona } from './effects/corona';

const factories: EffectFactory[] = [
  createCorona,
  // Phase 2 待补：bubbles, clay, confetti, ...（21 个）
];

const map = new Map<string, AnimationEffect>();
const list: AnimationEffect[] = [];

export function initRegistry(stage: Two): void {
  map.clear();
  list.length = 0;
  for (const factory of factories) {
    const effect = factory(stage);
    if (map.has(effect.key)) {
      console.warn(`[animations] key '${effect.key}' 重复注册，覆盖`);
    }
    map.set(effect.key, effect);
    list.push(effect);
  }
}

export function fire(key: string): boolean {
  const effect = map.get(key.toLowerCase());
  if (!effect) return false;
  effect.start();
  return true;
}

export function resizeAll(): void {
  list.forEach((e) => e.onResize?.());
}

export function getRegistered(): readonly string[] {
  return Array.from(map.keys());
}
