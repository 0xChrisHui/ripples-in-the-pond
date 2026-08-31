import { getShowcasePose } from '../../showcase/showcase-state';
import type { Drop } from '../../water/ripple-feed';
import { getP9EffectValue } from '../tuning/p9-tuning-store';
import { getP9Voices, type P9Voice } from './p9-state';

function addDrop(out: Drop[], voice: P9Voice, drop: Drop): void {
  if (voice.emittedMask & 1) return;
  voice.emittedMask |= 1;
  out.push(drop);
}

/** 水滴只对白名单中的 U 生效；T 与 V 的波形由水面着色器独立绘制。 */
export function collectP9Drops(now: number): Drop[] {
  const out: Drop[] = [];
  const pose = getShowcasePose();
  for (const voice of getP9Voices(now)) {
    if (!voice.effect.waterWrite || voice.effect.mode !== 'droplet') continue;
    const motion = voice.reduced ? 0.25 : 1;
    addDrop(out, voice, {
      ux: pose.x,
      uy: 1 - pose.y,
      radius: getP9EffectValue(voice.effect.id, 'radius', 0.04),
      strength: getP9EffectValue(voice.effect.id, 'strength', 0.2) * motion * voice.strength,
    });
  }
  return out;
}
