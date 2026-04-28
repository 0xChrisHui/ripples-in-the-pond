/**
 * Phase 6 B2 - SVG 动画引擎入口（移植 references/aaaa/patatap-engine.jsx + 补齐 8 缺失）
 *
 * 26 键独立映射 — 跟原 patatap QWERTY 三排定位严格对齐：
 * Row 0: q w e r t y u i o p
 * Row 1: a s d f g h j k l
 * Row 2: z x c v b n m
 *
 * 总 17 个独立动画 + 3 multi-variant（flashes/pistons/prisms × 3 变体 = 9 键）= 26 键各对各
 */
import type { AnimFn } from './types';
import { PALETTES } from './palettes';
import { bubbles } from './effects/bubbles';
import { clay } from './effects/clay';
import { confetti } from './effects/confetti';
import { corona } from './effects/corona';
import { flashes } from './effects/flashes';
import { glimmer } from './effects/glimmer';
import { moon } from './effects/moon';
import { pinwheel } from './effects/pinwheel';
import { pistons } from './effects/pistons';
import { prisms } from './effects/prisms';
import { spiral } from './effects/spiral';
import { splits } from './effects/splits';
import { squiggle } from './effects/squiggle';
import { strike } from './effects/strike';
import { suspension } from './effects/suspension';
import { timer } from './effects/timer';
import { ufo } from './effects/ufo';
import { veil } from './effects/veil';
import { wipe } from './effects/wipe';
import { zigzag } from './effects/zigzag';

const variant = (fn: AnimFn, v: number): AnimFn => (ctx) => fn({ ...ctx, variant: v });

const ANIM_BY_KEY: Record<string, AnimFn> = {
  // Row 0
  q: variant(flashes, 0), w: clay,             e: moon,             r: variant(pistons, 1),
  t: timer,              y: suspension,        u: variant(prisms, 0), i: squiggle,
  o: glimmer,            p: spiral,
  // Row 1
  a: variant(flashes, 1), s: veil,             d: ufo,              f: variant(pistons, 2),
  g: bubbles,             h: strike,           j: variant(prisms, 1), k: pinwheel,
  l: zigzag,
  // Row 2
  z: variant(flashes, 2), x: wipe,             c: splits,           v: variant(pistons, 3),
  b: corona,              n: confetti,         m: variant(prisms, 2),
};

export function trigger(svg: SVGSVGElement, key: string, paletteKey = 'grey'): boolean {
  const fn = ANIM_BY_KEY[key.toLowerCase()];
  if (!fn) return false;
  const w = svg.clientWidth || window.innerWidth;
  const h = svg.clientHeight || window.innerHeight;
  const p = PALETTES[paletteKey] || PALETTES.grey;
  try {
    fn({ svg, w, h, p });
    return true;
  } catch (err) {
    console.error('[svg-anim] error:', err);
    return false;
  }
}

export function getRegisteredKeys(): string[] {
  return Object.keys(ANIM_BY_KEY);
}
