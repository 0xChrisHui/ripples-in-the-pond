import type { ShowcasePose } from '../../showcase/showcase-state';
import { getP9EffectValue, getP9FamilyValue } from '../tuning/p9-tuning-store';
import { getP9Mode, type P9Frame } from '../runtime/p9-sampler';
import { externalWave, mixHex, paletteColor } from '../runtime/p9-visual-math';
import { getP9PetalBurstOrigins } from './p9-petals';

export interface P9MotePoint {
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

export interface P9MoteStyle {
  density: number;
  size: number;
  opacity: number;
  color: string;
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));
const hash = (value: number): number => Math.abs(Math.sin(value * 91.731) * 43758.5453) % 1;
const settledOffsets = new Map<number, readonly [number, number]>();
const settledVoice = new Map<number, number>();
const transformedVoice = new Map<number, number>();
const consumedVoice = new Map<number, number>();
const respawns = new Map<number, { at: number; offset: readonly [number, number] }>();

export function getP9MoteStyle(frame: P9Frame): P9MoteStyle {
  const density = frame.channels.motes * 0.16;
  let size = frame.channels.motes * 1.6;
  let opacity = frame.channels.motes * 0.18;
  let color = paletteColor(0);
  for (const cue of frame.lanes.motes) {
    if (cue.mode === 'motes-flash') {
      const gain = getP9EffectValue(cue.voice.effect.id, 'brightness', 1.2);
      size += cue.energy * gain * 3.4;
      opacity += cue.energy * gain * 0.34;
    }
    if (cue.mode === 'motes-hue') {
      color = mixHex(color, paletteColor(cue.palettePosition), clamp(cue.energy));
    }
  }
  opacity = Math.min(opacity, getP9FamilyValue('motes', 'brightness', 1.4));
  return { density, size, opacity, color };
}

/** 同一批真实 Points 同时接受显隐、轨迹、换色和环境力，任何声部都不覆盖另一个。 */
export function modulateP9Mote(
  seed: number,
  bx: number,
  by: number,
  frame: P9Frame,
  target: ShowcasePose,
): P9MotePoint {
  const now = performance.now() / 1000;
  const respawn = respawns.get(seed);
  if (respawn && now >= respawn.at) {
    settledOffsets.set(seed, respawn.offset);
    respawns.delete(seed);
  }
  const settled = settledOffsets.get(seed) ?? [0, 0];
  let x = bx + settled[0], y = by + settled[1], alpha = 1, scale = 1;
  if (respawns.has(seed)) alpha = 0;
  const tx = target.x * 2 - 1, ty = 1 - target.y * 2;
  for (const cue of frame.lanes.motes) {
    const id = cue.voice.effect.id;
    if (cue.mode === 'motes-ingest') {
      const selected = hash(seed * 113 + cue.voice.seed) < getP9EffectValue(id, 'ratio', 0.3);
      const committed = consumedVoice.get(seed) === cue.voice.seed;
      if (selected && !committed) {
        const pull = clamp(cue.progress / 0.72) ** 2 * Math.min(0.98, cue.motion);
        x += (tx - x) * pull; y += (ty - y) * pull;
        alpha *= 1 - clamp((pull - 0.72) / 0.26);
        if (cue.progress >= 0.72) {
          consumedVoice.set(seed, cue.voice.seed);
          const nx = hash(seed * 211 + cue.voice.seed) * 1.8 - 0.9;
          const ny = hash(seed * 223 + cue.voice.seed) * 1.8 - 0.9;
          respawns.set(seed, { at: now + 1.4 + hash(seed * 227) * 2.2, offset: [nx - bx, ny - by] });
          alpha = 0;
        }
      }
    }
    if (cue.mode === 'motes-extinguish') {
      const duration = cue.voice.effect.duration;
      const elapsed = cue.progress * duration - hash(seed * 17) * 0.35;
      const fadeOut = getP9EffectValue(id, 'fadeOut', 0.25);
      const hold = getP9EffectValue(id, 'hold', 0.25);
      const fadeIn = getP9EffectValue(id, 'fadeIn', 0.25);
      alpha *= elapsed < fadeOut ? 1 - clamp(elapsed / fadeOut)
        : elapsed < fadeOut + hold ? 0
          : clamp((elapsed - fadeOut - hold) / fadeIn);
    }
    if (cue.mode === 'motes-sparkle') {
      const randomMotion = getP9FamilyValue('motes', 'motionMin', 0.2)
        + hash(seed * 43) * (getP9FamilyValue('motes', 'motionMax', 1.2) - 0.2);
      const segments = 9, phase = cue.progress * cue.motionScale * segments;
      let dx = 0, dy = 0;
      for (let step = 0; step <= Math.min(segments - 1, Math.floor(phase)); step += 1) {
        const fraction = step < Math.floor(phase) ? 1 : phase - step;
        const eased = fraction * fraction * (3 - 2 * fraction);
        const angle = hash(seed * 37 + cue.voice.seed + step * 19) * Math.PI * 2;
        const distance = (1 - step / segments) ** 1.7 * 0.018 * randomMotion * eased * (cue.voice.reduced ? 0.22 : 1);
        dx += Math.cos(angle) * distance; dy += Math.sin(angle) * distance;
      }
      const committed = settledVoice.get(seed) === cue.voice.seed;
      if (!committed) { x += dx; y += dy; }
      if (cue.progress > 0.96 && !committed) {
        settledOffsets.set(seed, [settled[0] + dx, settled[1] + dy]);
        settledVoice.set(seed, cue.voice.seed);
      }
      alpha *= clamp(0.5 + hash(seed * 9) * 0.55) * (1 + getP9EffectValue(id, 'brightness', 1.5) * 0.16);
      scale *= getP9FamilyValue('motes', 'scaleMin', 0.7) + hash(seed * 61)
        * (getP9FamilyValue('motes', 'scaleMax', 1.5) - getP9FamilyValue('motes', 'scaleMin', 0.7));
    }
    if (cue.mode === 'motes-colony' && hash(seed * 127 + cue.voice.seed) < 0.38) {
      const spread = getP9EffectValue(id, 'spread', 1);
      const breath = getP9EffectValue(id, 'breath', 1);
      const center = cue.voice.angle + (hash(cue.voice.seed * 17) - 0.5) * 0.8;
      const phase = cue.progress * cue.motionScale * Math.PI * 2 * breath + hash(seed * 131) * Math.PI * 2;
      const envelope = Math.sin(cue.progress * Math.PI);
      const radius = (0.035 + hash(seed * 137) * 0.07) * spread * envelope * cue.motion;
      x += Math.cos(center + phase * 0.22) * radius;
      y += Math.sin(center + phase * 0.22) * radius;
    }
  }
  for (const cue of frame.lanes.petals) {
    const launchAt = cue.voice.commitProgress;
    const burst = cue.mode === 'petal-burst', origins = burst ? getP9PetalBurstOrigins(cue.voice.seed, now) : [];
    const selected = burst ? origins.length > 0 && hash(seed * 71 + cue.voice.seed) < getP9EffectValue(cue.voice.effect.id, 'moteRatio', 0.16)
      : cue.mode === 'petal-transform' && launchAt >= 0 && hash(seed * 71 + cue.voice.seed) <= 0.05 * getP9EffectValue(cue.voice.effect.id, 'count', 2);
    if (!selected) continue;
    const emerge = burst ? clamp(cue.progress / 0.32) : clamp((cue.progress - launchAt) / 0.32);
    const angle = cue.voice.angle + hash(seed * 97) * Math.PI * 1.4, origin = burst ? origins[Math.floor(hash(seed * 109) * origins.length)] : [tx, ty];
    const spread = burst ? getP9EffectValue(cue.voice.effect.id, 'spread', 1) : 1;
    x = origin[0] + Math.cos(angle) * emerge * cue.motionScale * (0.08 + hash(seed * 103) * 0.48) * spread;
    y = origin[1] + Math.sin(angle) * emerge * cue.motionScale * (0.08 + hash(seed * 107) * 0.48) * spread;
    const boost = getP9EffectValue(cue.voice.effect.id, 'launchBoost', 2), recovery = 1 + (boost - 1) * (1 - emerge);
    alpha *= recovery; scale *= recovery;
    if (emerge >= 1 && transformedVoice.get(seed) !== cue.voice.seed) { settledOffsets.set(seed, [x - bx, y - by]); transformedVoice.set(seed, cue.voice.seed); }
  }
  for (const force of [...frame.lanes.water, ...frame.lanes.scene]) {
    if (!['directional-wave', 'shared-force'].includes(force.mode)) continue;
    if (force.mode === 'directional-wave') {
      const wave = externalWave(force.voice.angle, force.progress * force.motionScale, (x + 1) / 2, (1 - y) / 2);
      x += wave.x * wave.front * force.motion * 0.07;
      y -= wave.y * wave.front * force.motion * 0.07;
      continue;
    }
    const scatter = (hash(seed * 53 + force.voice.seed) - 0.5) * getP9FamilyValue('scene', 'scatter', 0.7);
    const angle = force.voice.angle + scatter;
    const amount = force.motion * (0.045 + hash(seed * 67) * 0.055);
    x += Math.cos(angle) * amount; y += Math.sin(angle) * amount;
  }
  const flash = getP9Mode(frame, 'motes-flash');
  if (flash) alpha *= 1 + flash.hitPulse * 0.45;
  return { x, y, alpha: clamp(alpha, 0, 2.5), scale: clamp(scale, 0.4, 2.5) };
}
