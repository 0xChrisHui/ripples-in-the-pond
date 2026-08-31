import type { P9Channels, P9Lane, P9Mode } from '../registry';
import { getP9EffectValue, getP9FamilyValue } from '../tuning/p9-tuning-store';
import { getP9Revision, getP9Voices, type P9Voice } from './p9-state';

export interface P9VoiceFrame {
  voice: P9Voice;
  mode: P9Mode;
  progress: number;
  motionScale: number;
  energy: number;
  motion: number;
  hitPulse: number;
  palettePosition: number;
}

export interface P9Frame {
  channels: P9Channels;
  lanes: Record<P9Lane, readonly P9VoiceFrame[]>;
  voices: readonly P9VoiceFrame[];
}

const channelKeys: (keyof P9Channels)[] = ['eclipse', 'motes', 'petals', 'water', 'moon', 'global'];
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
let cachedRevision = -1;
let cachedFrame: P9Frame | null = null;
let cacheReleaseRaf = 0;
let framePasses = 0;

function holdFrameCache(): void {
  if (cacheReleaseRaf) return;
  cacheReleaseRaf = requestAnimationFrame(() => {
    cachedFrame = null;
    cacheReleaseRaf = 0;
  });
}

export function sampleP9Voice(voice: P9Voice, now: number): P9VoiceFrame {
  const elapsed = now - voice.startedAt;
  const duration = Math.max(voice.effect.duration, voice.endsAt - voice.startedAt);
  const bounded = voice.effect.retrigger === 'bounded-envelope';
  const attackTime = bounded ? getP9EffectValue(voice.effect.id, 'fadeIn', getP9FamilyValue(voice.effect.lane, 'attack', 0.12)) : getP9FamilyValue(voice.effect.lane, 'attack', 0.12);
  const releaseTime = bounded ? getP9EffectValue(voice.effect.id, 'fadeOut', getP9FamilyValue(voice.effect.lane, 'release', 0.9)) : getP9FamilyValue(voice.effect.lane, 'release', 0.9);
  const stack = getP9FamilyValue(voice.effect.lane, 'stack', 1);
  const attack = clamp(elapsed / (voice.reduced ? Math.max(0.2, attackTime) : attackTime), 0, 1);
  const release = clamp((voice.endsAt - now) / releaseTime, 0, 1);
  const continuous = voice.effect.retrigger === 'smooth-accumulate' || voice.effect.retrigger === 'velocity-impulse';
  if (voice.effect.retrigger === 'velocity-impulse') {
    const delta = clamp(now - voice.sampledAt, 0, 0.05);
    const quiet = now - voice.lastHitAt;
    const damping = voice.effect.id === 'FX25' ? getP9EffectValue('FX25', 'damping', 1.2) : 0.72;
    const returnForce = voice.effect.id === 'FX25' ? damping : 1.25;
    if (quiet > 0.28) voice.velocity -= delta * (returnForce / Math.max(0.3, releaseTime));
    voice.velocity *= Math.exp(-delta * damping);
    voice.renderedStrength = clamp(voice.renderedStrength + voice.velocity * delta, 0, voice.strength);
    if (voice.renderedStrength >= voice.strength && voice.velocity > 0) voice.velocity *= 0.35;
    voice.sampledAt = now;
  } else if (voice.effect.retrigger === 'smooth-accumulate') {
    const delta = clamp(now - voice.sampledAt, 0, 0.05);
    const quiet = now - voice.lastHitAt;
    if (quiet > 0.28) voice.strength *= Math.exp(-delta / Math.max(0.18, releaseTime));
    const ease = 1 - Math.exp(-delta * (voice.reduced ? 4 : 7));
    voice.renderedStrength += (voice.strength - voice.renderedStrength) * ease;
    voice.sampledAt = now;
  } else {
    voice.renderedStrength = voice.strength;
    voice.sampledAt = now;
  }
  const energy = (continuous
    ? voice.renderedStrength * Math.min(1, release * 1.4)
    : attack * release * voice.renderedStrength) * stack;
  const paletteDuration = Math.max(0.01, getP9EffectValue(voice.effect.id, 'transition', 2));
  const paletteProgress = clamp((now - voice.paletteStartedAt) / paletteDuration, 0, 1);
  const paletteEase = paletteProgress * paletteProgress * (3 - 2 * paletteProgress);
  const progress = clamp(elapsed / duration, 0, 1);
  return {
    voice,
    mode: voice.effect.mode,
    progress,
    motionScale: voice.reduced ? 0.22 : 1,
    energy,
    motion: energy * getP9EffectValue(voice.effect.id, 'motion', 1) * (voice.reduced ? 0.22 : 1),
    hitPulse: Math.exp(-Math.max(0, now - voice.lastHitAt) * 5.5),
    palettePosition: voice.paletteFrom + (voice.paletteTo - voice.paletteFrom) * paletteEase,
  };
}

export function sampleP9(now: number): P9Frame {
  const revision = getP9Revision();
  if (cachedFrame && revision === cachedRevision) return cachedFrame;
  const channels: P9Channels = { eclipse: 0, motes: 0, petals: 0, water: 0, moon: 0, global: 0 };
  framePasses += 1;
  const lanes: Record<P9Lane, P9VoiceFrame[]> = {
    eclipse: [], motes: [], petals: [], water: [], scene: [],
  };
  const frames = getP9Voices(now).map((voice) => sampleP9Voice(voice, now));
  for (const frame of frames) {
    const { effect } = frame.voice;
    const channelEnergy = frame.energy * (frame.voice.reduced ? 0.35 : 1);
    lanes[effect.lane].push(frame);
    for (const key of channelKeys) {
      if (key === 'moon' && !effect.moonWrite) continue;
      channels[key] += effect.channels[key] * channelEnergy;
    }
  }
  for (const key of channelKeys) channels[key] = clamp(channels[key], -1, 1.5);
  cachedRevision = getP9Revision();
  cachedFrame = { channels, lanes, voices: frames };
  holdFrameCache();
  return cachedFrame;
}

export function getP9SamplerStats() { return { framePasses, cacheActive: cachedFrame !== null }; }

export function getP9Mode(frame: P9Frame, mode: P9Mode): P9VoiceFrame | null {
  return frame.voices.filter((item) => item.mode === mode).sort((a, b) => b.energy - a.energy)[0] ?? null;
}

export function getP9Modes(frame: P9Frame, ...modes: P9Mode[]): readonly P9VoiceFrame[] {
  const wanted = new Set<P9Mode>(modes);
  return frame.voices.filter((item) => wanted.has(item.mode));
}

export function sumP9Mode(frame: P9Frame, mode: P9Mode): number {
  return frame.voices.reduce((sum, item) => sum + (item.mode === mode ? item.energy : 0), 0);
}
