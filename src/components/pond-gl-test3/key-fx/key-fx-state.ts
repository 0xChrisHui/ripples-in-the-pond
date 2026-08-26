import { prefersReducedMotion } from '../reduced-motion';
import { KEY_FX_BEHAVIORS } from './key-fx-behaviors';
import type { KeyFxFamily } from './key-fx-types';
export type { KeyFxFamily } from './key-fx-types';
export interface KeyFxDetail {
  key: string;
  family?: KeyFxFamily;
  x?: number;
  y?: number;
  strength?: number;
  size?: number;
  duration?: number;
  petalStrength?: number;
}
export interface KeyFxPulse {
  family: KeyFxFamily;
  startedAt: number;
  lastHitAt: number;
  endsAt: number;
  stageEpochAt: number;
  emittedMask: number;
  x: number;
  y: number;
  angle: number;
  strength: number;
  hits: number;
}
export interface KeyFxModulation {
  motes: number;
  water: number;
  halo: number;
  moon: number;
  petals: number;
}
export interface KeyFxField { dx: number; dy: number; glow: number }
export interface KeyFxDrop { ux: number; uy: number; radius: number; strength: number }

const KEY_FAMILY: Readonly<Record<string, KeyFxFamily>> = {
  r: 'pressure', v: 'resonance', w: 'shear', space: 'motes', q: 'capillary',
  b: 'sink', c: 'relay', d: 'petals', f: 'dew', o: 'lift',
};

const MAX_VOICES = 8;
const pulses: KeyFxPulse[] = [];
let sequence = 0;

function hash01(n: number): number {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
}

export function sampleKeyFxPulse(pulse: KeyFxPulse, now: number): number {
  const duration = KEY_FX_BEHAVIORS[pulse.family].duration;
  const attack = Math.min(1, Math.max(0, now - pulse.startedAt) / 0.08);
  const tail = Math.min(1, Math.max(0, pulse.endsAt - now) / (duration * 0.62));
  return attack * tail * Math.min(1.25, pulse.strength);
}

/** 同家族连击汇入旧 voice：保留场的位置和能量，只重新注入局部水力。 */
export function triggerKeyFx(key: string): KeyFxDetail {
  const family = KEY_FAMILY[key];
  if (!family || prefersReducedMotion()) return { key };
  const now = performance.now() / 1000;
  const behavior = KEY_FX_BEHAVIORS[family];
  const seed = key.charCodeAt(0) * 17 + sequence++ * 31;
  const angle = hash01(seed) * Math.PI * 2;
  const radius = 0.18 + hash01(seed + 9) * 0.18;
  let x = 0.5 + Math.cos(angle) * radius;
  let y = 0.5 + Math.sin(angle) * radius * 0.72;
  if (family === 'relay' || family === 'lift') {
    x = 0.5; y = 0.5;
  }
  const current = [...pulses].reverse().find((p) =>
    p.family === family && now - p.lastHitAt <= behavior.mergeWindow);

  if (current) {
    current.x += (x - current.x) * 0.24;
    current.y += (y - current.y) * 0.24;
    current.lastHitAt = now;
    current.endsAt = Math.max(current.endsAt, now + behavior.duration * 0.72);
    current.stageEpochAt = now;
    current.emittedMask = 0;
    current.strength = Math.min(1.25, current.strength + 0.16);
    current.hits++;
  } else {
    pulses.push({ family, startedAt: now, lastHitAt: now, endsAt: now + behavior.duration,
      stageEpochAt: now, emittedMask: 0, x, y, angle, strength: 1, hits: 1 });
    if (pulses.length > MAX_VOICES) pulses.splice(0, pulses.length - MAX_VOICES);
  }

  return { key, family, x, y, strength: 1,
    size: behavior.fieldRadius * window.innerHeight * 2,
    duration: behavior.duration, petalStrength: behavior.channels.petals };
}

export function getKeyFxPulses(now: number): readonly KeyFxPulse[] {
  for (let i = pulses.length - 1; i >= 0; i--) {
    if (now >= pulses[i].endsAt) pulses.splice(i, 1);
  }
  return pulses;
}

/** 每个 stage 只注入一次真实高度场；没有额外全屏图形层。 */
export function collectKeyFxDrops(now: number): KeyFxDrop[] {
  const drops: KeyFxDrop[] = [];
  for (const pulse of getKeyFxPulses(now)) {
    const behavior = KEY_FX_BEHAVIORS[pulse.family];
    for (let i = 0; i < behavior.ripples.length; i++) {
      const bit = 1 << i;
      const stage = behavior.ripples[i];
      if ((pulse.emittedMask & bit) || now - pulse.stageEpochAt < stage.at) continue;
      pulse.emittedMask |= bit;
      const cs = Math.cos(pulse.angle), sn = Math.sin(pulse.angle);
      const dx = stage.dx * cs - stage.dy * sn;
      const dy = stage.dx * sn + stage.dy * cs;
      drops.push({ ux: Math.min(0.96, Math.max(0.04, pulse.x + dx)),
        uy: Math.min(0.96, Math.max(0.04, pulse.y + dy)), radius: stage.radius,
        strength: stage.strength * Math.min(1.2, pulse.strength) });
    }
  }
  return drops;
}

export function sampleKeyFx(now: number): KeyFxModulation {
  const out: KeyFxModulation = { motes: 0, water: 0, halo: 0, moon: 0, petals: 0 };
  for (const pulse of getKeyFxPulses(now)) {
    const behavior = KEY_FX_BEHAVIORS[pulse.family];
    const energy = sampleKeyFxPulse(pulse, now);
    out.motes += behavior.channels.motes * energy;
    out.water += behavior.channels.water * energy;
    out.halo += behavior.channels.halo * energy;
    out.petals += behavior.channels.petals * energy;
  }
  out.motes = Math.min(1, out.motes); out.water = Math.min(1, out.water);
  out.halo = Math.min(0.65, out.halo); out.petals = Math.min(1, out.petals);
  return out;
}

/** 漂浮微光读取同一局部场；不同家族只改变力的性格，不生成独立图案。 */
export function sampleKeyFxField(now: number, x: number, y: number): KeyFxField {
  const out: KeyFxField = { dx: 0, dy: 0, glow: 0 };
  for (const pulse of getKeyFxPulses(now)) {
    const behavior = KEY_FX_BEHAVIORS[pulse.family];
    const rx = x - pulse.x, ry = y - pulse.y;
    const dist = Math.hypot(rx, ry);
    const w = Math.pow(Math.max(0, 1 - dist / behavior.fieldRadius), 2) * sampleKeyFxPulse(pulse, now);
    if (w <= 0) continue;
    const inv = 1 / Math.max(0.015, dist);
    if (pulse.family === 'pressure' || pulse.family === 'sink'
      || pulse.family === 'motes' || pulse.family === 'dew') {
      out.dx -= rx * inv * w * 0.012; out.dy -= ry * inv * w * 0.012;
    } else if (pulse.family === 'resonance' || pulse.family === 'relay') {
      const k = Math.sin((now - pulse.startedAt) * 9 + dist * 38) * w * 0.009;
      out.dx += rx * inv * k; out.dy += ry * inv * k;
    } else if (pulse.family === 'shear' || pulse.family === 'petals') {
      out.dx += Math.cos(pulse.angle) * w * 0.018;
      out.dy += Math.sin(pulse.angle) * w * 0.018;
    } else if (pulse.family === 'lift') {
      out.dy += w * 0.018;
    } else if (pulse.family === 'capillary') {
      out.dy += Math.sin((now - pulse.lastHitAt) * 28 + dist * 70) * w * 0.012;
    }
    out.glow += w * (pulse.family === 'dew' || pulse.family === 'motes' ? 1 : 0.35);
  }
  out.glow = Math.min(1, out.glow);
  return out;
}
