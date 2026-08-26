'use client';

import { prefersReducedMotion } from '../reduced-motion';

export type ShowcaseKind = 'eccentric' | 'motes' | 'stitch' | 'quiet' | 'transit';

export interface ShowcaseSample {
  progress: number;
  energy: number;
  angle: number;
}

export interface ShowcasePose {
  active: boolean;
  x: number;
  y: number;
  scale: number;
}

interface Voice {
  startedAt: number;
  lastHitAt: number;
  endsAt: number;
  strength: number;
  angle: number;
}

const KEY_KIND: Readonly<Record<string, ShowcaseKind>> = {
  a: 'eccentric',
  b: 'motes',
  c: 'stitch',
  d: 'quiet',
  e: 'transit',
};

const DURATION: Readonly<Record<ShowcaseKind, number>> = {
  eccentric: 2.2,
  motes: 3.4,
  stitch: 3.2,
  quiet: 3.6,
  transit: 3.4,
};

const voices = new Map<ShowcaseKind, Voice>();
let pose: ShowcasePose = { active: false, x: 0.5, y: 0.5, scale: 1 };
let sequence = 0;
let transitCooldownUntil = 0;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function direction(seed: number): number {
  return (Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1) * Math.PI * 2;
}

/** 日食层每帧写入真实屏幕位置，所有消费者因此围绕同一个播放核心编舞。 */
export function setShowcasePose(next: ShowcasePose): void {
  pose = next;
}

export function getShowcasePose(): ShowcasePose {
  return pose;
}

/** 新五效唯一入口；没有播放日食时只保留声音，不生成脱离场景的视觉。 */
export function emitShowcaseFx(key: string): boolean {
  const kind = KEY_KIND[key.toLowerCase()];
  if (!kind || !pose.active || prefersReducedMotion()) return false;
  const now = performance.now() / 1000;
  const current = voices.get(kind);
  if (kind === 'transit' && !current && now < transitCooldownUntil) return false;
  if (current && now < current.endsAt) {
    current.lastHitAt = now;
    current.endsAt = Math.max(current.endsAt, now + DURATION[kind] * 0.55);
    current.strength = Math.min(1.25, current.strength + 0.16);
    return true;
  }
  const duration = DURATION[kind];
  voices.set(kind, {
    startedAt: now,
    lastHitAt: now,
    endsAt: now + duration,
    strength: 1,
    angle: direction(key.charCodeAt(0) * 17 + sequence++ * 31),
  });
  if (kind === 'transit') transitCooldownUntil = now + duration + 1.8;
  return true;
}

export function sampleShowcase(kind: ShowcaseKind, now: number): ShowcaseSample {
  const voice = voices.get(kind);
  if (!voice || now >= voice.endsAt || !pose.active) {
    if (voice && now >= voice.endsAt) voices.delete(kind);
    return { progress: 0, energy: 0, angle: 0 };
  }
  const duration = DURATION[kind];
  const age = now - voice.startedAt;
  const attack = clamp01(age / 0.12);
  const release = clamp01((voice.endsAt - now) / Math.min(0.9, duration * 0.28));
  return {
    progress: clamp01(age / duration),
    energy: attack * release * voice.strength,
    angle: voice.angle,
  };
}
