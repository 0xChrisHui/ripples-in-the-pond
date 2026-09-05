'use client';

import { prefersReducedMotion } from '../../reduced-motion';
import { getShowcasePose } from '../../showcase/showcase-state';
import { findP9Effect, getP9ParamMeta, type P9Accent, type P9EffectDefinition } from '../registry';
import { getP9EffectValue, getP9FamilyValue } from '../tuning/p9-tuning-store';

export const P9_TRIGGER_EVENT = 'jam:p9-trigger';
const VOICE_LIMIT: Record<P9Accent, number> = { local: 20, environment: 16, global: 12 };
const GLOBAL_REATTACK_IDS = new Set(['FX41', 'FX42']);
const GLOBAL_REATTACK_COOLDOWN = 0.18;

export interface P9Voice {
  effect: P9EffectDefinition;
  startedAt: number;
  lastHitAt: number;
  endsAt: number;
  strength: number;
  renderedStrength: number;
  sampledAt: number;
  hits: number;
  angle: number;
  seed: number;
  emittedMask: number;
  commitProgress: number;
  reduced: boolean;
  paletteFrom: number;
  paletteTo: number;
  paletteStartedAt: number;
  velocity: number;
}

export interface P9TriggerDetail {
  effect: P9EffectDefinition;
  accepted: boolean;
  reason?: 'no-eclipse' | 'capacity';
}

const voices: P9Voice[] = [];
let sequence = 0;
let revision = 0;
let lastGlobalReattackAt = -Infinity;

function hash01(value: number): number {
  return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1;
}

function activeInAccent(accent: P9Accent, now: number): P9Voice[] {
  return voices.filter((voice) => voice.effect.accent === accent && voice.endsAt > now);
}

/** 超预算时让最弱声部提前释放，不删除、不排队，保证新旧效果仍有短暂重叠。 */
function softenBudget(accent: P9Accent, now: number): void {
  const active = activeInAccent(accent, now);
  if (active.length < VOICE_LIMIT[accent]) return;
  const weakest = active.sort((a, b) => a.strength - b.strength || a.lastHitAt - b.lastHitAt)[0];
  weakest.endsAt = Math.min(weakest.endsAt, now + getP9FamilyValue(weakest.effect.lane, 'release', 0.9));
}

function dispatch(detail: P9TriggerDetail): void {
  window.dispatchEvent(new CustomEvent<P9TriggerDetail>(P9_TRIGGER_EVENT, { detail }));
}

function palettePosition(voice: P9Voice, now: number): number {
  const duration = getP9EffectValue(voice.effect.id, 'transition', 2);
  const progress = Math.min(1, Math.max(0, (now - voice.paletteStartedAt) / duration));
  const eased = progress * progress * (3 - 2 * progress);
  return voice.paletteFrom + (voice.paletteTo - voice.paletteFrom) * eased;
}

function reinforce(voice: P9Voice, now: number): P9TriggerDetail {
  const gain = getP9EffectValue(voice.effect.id, 'hitGain', getP9EffectValue(voice.effect.id, 'gain', 0.14));
  const ceiling = getP9EffectValue(voice.effect.id, 'ceiling', 2);
  if (voice.effect.retrigger === 'palette-cycle') {
    voice.paletteFrom = palettePosition(voice, now);
    voice.paletteTo += 1;
    voice.paletteStartedAt = now;
  }
  if (voice.effect.retrigger === 'velocity-impulse') {
    voice.velocity = voice.velocity < 0 ? 0 : Math.min(2.4, voice.velocity + Math.max(0.08, gain * 1.6));
  }
  voice.lastHitAt = now;
  const hold = getP9EffectValue(voice.effect.id, 'hold', 0.5);
  const transition = getP9EffectValue(voice.effect.id, 'transition', 2);
  voice.endsAt = Math.max(voice.endsAt, now + (voice.effect.retrigger === 'palette-cycle' ? hold + transition + 1 : voice.effect.duration * 0.72));
  voice.strength = Math.min(ceiling, voice.strength + gain);
  voice.hits += 1;
  voice.emittedMask = 0;
  revision += 1;
  return { effect: voice.effect, accepted: true };
}

function hasHitGain(effect: P9EffectDefinition): boolean {
  return getP9ParamMeta(effect).some((item) => item.key === 'hitGain');
}

function spawnLimit(effect: P9EffectDefinition): number {
  const configured = Math.max(1, Math.round(getP9EffectValue(effect.id, 'batchLimit', effect.mode === 'spore-burst' ? 6 : 5)));
  return effect.id === 'FX32' || effect.id === 'FX44' ? Math.min(5, configured) : configured;
}

function resetVoice(voice: P9Voice, effect: P9EffectDefinition, now: number, elapsed = 0): void {
  const seed = effect.number * 97 + sequence++ * 31;
  const gradual = effect.retrigger === 'smooth-accumulate' || effect.retrigger === 'velocity-impulse';
  const startedAt = now - Math.min(effect.duration, Math.max(0, elapsed));
  Object.assign(voice, {
    effect, startedAt, lastHitAt: startedAt, endsAt: startedAt + effect.duration,
    strength: 1, renderedStrength: gradual ? 0 : 1,
    sampledAt: now, hits: 1, angle: hash01(seed) * Math.PI * 2, seed,
    emittedMask: elapsed > 0 ? 1 : 0, commitProgress: -1, reduced: prefersReducedMotion(), paletteFrom: 0, velocity: 1.15,
    paletteTo: effect.retrigger === 'palette-cycle' ? 1 : 0, paletteStartedAt: startedAt,
  });
}

/** 唯一触发入口：33 个 sound key 一一映射；不同效果并行，不建立全局等待队列。 */
export function triggerP9Effect(audioKey: string, elapsed = 0): P9TriggerDetail | null {
  const effect = findP9Effect(audioKey);
  if (!effect) return null;
  if (effect.requiresEclipse && !getShowcasePose().active) {
    const detail = { effect, accepted: false, reason: 'no-eclipse' } as const;
    dispatch(detail);
    return detail;
  }
  const now = performance.now() / 1000;
  const globalCooling = GLOBAL_REATTACK_IDS.has(effect.id)
    && now - lastGlobalReattackAt < GLOBAL_REATTACK_COOLDOWN;
  let globalAccentScale = 1;
  if (globalCooling) {
    const existingAccent = [...voices].reverse().find((voice) => voice.effect.id === effect.id && voice.endsAt > now);
    if (existingAccent) {
      existingAccent.lastHitAt = now;
      existingAccent.endsAt = Math.max(existingAccent.endsAt, now + effect.duration * 0.72);
      existingAccent.strength = Math.min(1.25, existingAccent.strength + 0.12);
      existingAccent.hits += 1;
      revision += 1;
      const detail = { effect, accepted: true } as const;
      dispatch(detail);
      return detail;
    }
    globalAccentScale = 0.22;
  }
  if (GLOBAL_REATTACK_IDS.has(effect.id) && !globalCooling) lastGlobalReattackAt = now;
  const canReinforce = ['smooth-accumulate', 'velocity-impulse', 'palette-cycle'].includes(effect.retrigger);
  const existing = canReinforce
    ? [...voices].reverse().find((voice) => voice.effect.id === effect.id && voice.endsAt > now)
    : undefined;
  if (existing) {
    const detail = reinforce(existing, now);
    dispatch(detail);
    return detail;
  }
  const sameEffect = voices.filter((voice) => voice.effect.id === effect.id && voice.endsAt > now);
  if (sameEffect.length >= spawnLimit(effect)) {
    const detail = { effect, accepted: false, reason: 'capacity' } as const;
    dispatch(detail);
    return detail;
  }
  softenBudget(effect.accent, now);
  const voice = {} as P9Voice;
  resetVoice(voice, effect, now, elapsed);
  if (sameEffect.length > 0 && effect.retrigger === 'bounded-envelope' && hasHitGain(effect)) {
    voice.strength = getP9EffectValue(effect.id, 'hitGain', 0.12);
    voice.renderedStrength = voice.strength;
  }
  if (globalAccentScale < 1) {
    voice.strength *= globalAccentScale;
    voice.renderedStrength *= globalAccentScale;
  }
  voices.push(voice);
  revision += 1;
  const detail = { effect, accepted: true } as const;
  dispatch(detail);
  return detail;
}

export function getP9Voices(now: number): readonly P9Voice[] {
  let changed = false;
  for (let index = voices.length - 1; index >= 0; index -= 1) {
    if (now >= voices[index].endsAt) { voices.splice(index, 1); changed = true; }
  }
  if (changed) revision += 1;
  return voices;
}

export function getP9Revision(): number { return revision; }

/** Score 路由销毁专用：清空未结束 voice，避免快速返回首页时残留演出。 */
export function resetP9Runtime(): void {
  voices.length = 0;
  sequence = 0;
  lastGlobalReattackAt = -Infinity;
  revision += 1;
}

export function getP9RuntimeStats(now = performance.now() / 1000) {
  const active = getP9Voices(now);
  return {
    voices: active.length,
    revision,
    byEffect: Object.fromEntries([...new Set(active.map((voice) => voice.effect.id))]
      .map((id) => [id, active.filter((voice) => voice.effect.id === id).length])),
  };
}
