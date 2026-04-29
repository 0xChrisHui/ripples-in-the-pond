/**
 * Phase 6 B2 — 动画注册中心
 *
 * 26 键 / 20 effect 文件（17 单变体 + 3 multi-variant 文件，每个 3 变体 = 9 键）
 * fire(key) 触发对应动画的 start()。
 */
import type Two from 'two.js';
import type { AnimationEffect, EffectFactory } from './types';

// 单变体 effects（17 键）
import { createBubbles } from './effects/bubbles';
import { createClay } from './effects/clay';
import { createConfetti } from './effects/confetti';
import { createCorona } from './effects/corona';
import { createGlimmer } from './effects/glimmer';
import { createMoon } from './effects/moon';
import { createPinwheel } from './effects/pinwheel';
import { createSpiral } from './effects/spiral';
import { createSplits } from './effects/splits';
import { createSquiggle } from './effects/squiggle';
import { createStrike } from './effects/strike';
import { createSuspension } from './effects/suspension';
import { createTimer } from './effects/timer';
import { createUfo } from './effects/ufo';
import { createVeil } from './effects/veil';
import { createWipe } from './effects/wipe';
import { createZigzag } from './effects/zigzag';

// Multi-variant effects（3 文件 × 3 变体 = 9 键）
import { flashesFactories } from './effects/flashes';
import { pistonsFactories } from './effects/pistons';
import { prismsFactories } from './effects/prisms';

const factories: EffectFactory[] = [
  createBubbles,    // g
  createClay,       // w
  createConfetti,   // n
  createCorona,     // b
  createGlimmer,    // o
  createMoon,       // e
  createPinwheel,   // k
  createSpiral,     // p
  createSplits,     // c
  createSquiggle,   // i
  createStrike,     // h
  createSuspension, // y
  createTimer,      // t
  createUfo,        // d
  createVeil,       // s
  createWipe,       // x
  createZigzag,     // l
  ...flashesFactories, // q a z
  ...pistonsFactories, // r f v
  ...prismsFactories,  // u j m
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
