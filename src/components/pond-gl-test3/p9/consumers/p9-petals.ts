import type { Petal, PetalVisualCue, PetalVisualFx } from '../../decor/water-petals-sim';
import type { ShowcasePose } from '../../showcase/showcase-state';
import { getP9EffectValue, getP9FamilyValue } from '../tuning/p9-tuning-store';
import type { P9Frame, P9VoiceFrame } from '../runtime/p9-sampler';
import { externalWave } from '../runtime/p9-visual-math';

const hash = (value: number): number => Math.abs(Math.sin(value * 73.17) * 43758.5453) % 1;
const stretchCommits = new WeakMap<Petal, number>();
const transformCommits = new WeakMap<Petal, number>();
interface TransformLife { state: 'dormant' | 'appearing'; respawnAt: number; fadeAt: number; fadeDuration: number; seed: number }
const transformLives = new WeakMap<Petal, TransformLife>();
interface BurstField { expiresAt: number; points: (readonly [number, number])[] }
const burstFields = new Map<number, BurstField>();

export function getP9PetalBurstOrigins(seed: number, now: number): readonly (readonly [number, number])[] {
  const field = burstFields.get(seed);
  if (!field || now >= field.expiresAt) { burstFields.delete(seed); return []; }
  return field.points;
}

export function getP9PetalBurstFieldCount(): number { return burstFields.size; }

function resetTransformLives(petals: Petal[], target: ShowcasePose, now: number): void {
  for (const petal of petals) {
    const life = transformLives.get(petal);
    if (!life) { petal.lifeAlpha = 1; petal.lifeScale = 1; continue; }
    petal.vx = 0; petal.vy = 0;
    if (life.state === 'dormant' && now < life.respawnAt) { petal.lifeAlpha = 0; petal.lifeScale = 0.05; continue; }
    if (life.state === 'dormant') {
      let bestX = 0.1, bestY = 0.1, bestDistance = -1;
      for (let at = 0; at < 6; at++) {
        const x = 0.08 + hash(life.seed * 31 + at * 7) * 0.84;
        const y = 0.1 + hash(life.seed * 37 + at * 11) * 0.8;
        const distance = Math.hypot(x - target.x, y - target.y);
        if (distance > bestDistance) { bestX = x; bestY = y; bestDistance = distance; }
      }
      petal.nx = bestX; petal.ny = bestY; petal.rot = hash(life.seed * 43) * Math.PI * 2;
      petal.vr = (hash(life.seed * 47) - 0.5) * 0.0022; petal.phase = hash(life.seed * 53) * Math.PI * 2;
      life.state = 'appearing'; life.fadeAt = now;
    }
    const alpha = Math.max(0, Math.min(1, (now - life.fadeAt) / life.fadeDuration));
    petal.lifeAlpha = alpha; petal.lifeScale = 0.72 + alpha * 0.28;
    if (alpha >= 1) transformLives.delete(petal);
  }
}

export function getP9PetalCount(base: number, frame: P9Frame): number {
  const extra = frame.lanes.petals.reduce((sum, cue) => cue.mode === 'petal-multiply'
    ? sum + Math.round(getP9EffectValue(cue.voice.effect.id, 'extra', 14))
    : sum, 0);
  return base + extra;
}

export function getP9PetalVisual(frame: P9Frame, count: number): PetalVisualFx | undefined {
  if (count === 0 || frame.lanes.petals.length === 0) return undefined;
  const cues: PetalVisualCue[] = frame.lanes.petals.map((cue) => ({
    mode: cue.mode,
    energy: cue.mode === 'petal-stretch' ? cue.motion : cue.energy,
    progress: cue.progress,
    selected: cue.mode === 'petal-multiply' ? Math.max(0, count - Math.round(getP9EffectValue(cue.voice.effect.id, 'extra', 14) * Math.min(1, cue.energy))) : cue.voice.seed % count,
    count: cue.mode === 'petal-ingest' ? getP9EffectValue(cue.voice.effect.id, 'count', 3) + cue.voice.hits - 1
      : cue.mode === 'petal-multiply' ? count : getP9EffectValue(cue.voice.effect.id, 'count', 1),
    value: cue.mode === 'petal-stretch' ? getP9EffectValue(cue.voice.effect.id, 'stretch', 8)
        : cue.mode === 'petal-transform' ? cue.voice.commitProgress
          : cue.mode === 'petal-multiply' ? getP9EffectValue(cue.voice.effect.id, 'dwellMax', 7) : 1,
    lineWidth: cue.mode === 'petal-multiply' ? getP9EffectValue(cue.voice.effect.id, 'dwellMin', 2.5)
        : getP9EffectValue(cue.voice.effect.id, 'lineWidth', 0.45),
    seed: cue.voice.seed,
    fadeIn: cue.mode === 'petal-multiply' ? getP9EffectValue(cue.voice.effect.id, 'fadeIn', 1.2) / cue.voice.effect.duration : 0,
    fadeOut: cue.mode === 'petal-multiply' ? getP9EffectValue(cue.voice.effect.id, 'fadeOut', 2.4) / cue.voice.effect.duration : 0,
  }));
  return { cues };
}

function selected(cue: P9VoiceFrame, index: number, length: number): boolean {
  const count = cue.mode === 'petal-burst'
    ? Math.max(1, Math.ceil(length * getP9EffectValue(cue.voice.effect.id, 'ratio', 0.1)))
    : getP9EffectValue(cue.voice.effect.id, 'count', 1) + (cue.mode === 'petal-ingest' ? cue.voice.hits - 1 : 0);
  const start = cue.voice.seed % length;
  return Array.from({ length: count }, (_, at) => (start + at * 3) % length).includes(index);
}

/** 每个声部独立累加到真实花瓣；疾行和环境力都按花瓣相位打散，并由边界阻尼接住。 */
export function applyP9PetalMotion(petals: Petal[], frame: P9Frame, target: ShowcasePose): void {
  const now = performance.now() / 1000;
  for (const [seed, field] of burstFields) {
    if (now >= field.expiresAt) burstFields.delete(seed);
  }
  if (petals.length === 0) return;
  resetTransformLives(petals, target, now);
  for (const cue of frame.lanes.petals) {
    const id = cue.voice.effect.id;
    for (const [index, petal] of petals.entries()) {
      const chosen = selected(cue, index, petals.length);
      if (cue.mode === 'petal-sprint') {
        const scatter = getP9EffectValue(id, 'scatter', 1.1);
        const angle = cue.voice.angle + (hash(petal.phase + cue.voice.seed) - 0.5) * Math.PI * scatter;
        const speed = getP9EffectValue(id, 'speed', 1) * (0.45 + hash(index * 7) * 0.9);
        petal.vx += Math.cos(angle) * cue.motion * speed * 0.00022;
        petal.vy += Math.sin(angle) * cue.motion * speed * 0.00022;
        const boundary = getP9FamilyValue('petals', 'boundary', 1) * 0.06;
        if ((petal.nx < boundary && petal.vx < 0) || (petal.nx > 1 - boundary && petal.vx > 0)) petal.vx *= 0.1;
        if ((petal.ny < boundary && petal.vy < 0) || (petal.ny > 1 - boundary && petal.vy > 0)) petal.vy *= 0.1;
      }
      if ((cue.mode === 'petal-ingest' || cue.mode === 'petal-transform') && chosen) {
        const pull = cue.mode === 'petal-ingest' ? getP9EffectValue(id, 'pull', 1.1) : 1.6;
        const committed = cue.mode === 'petal-transform' && transformCommits.get(petal) === cue.voice.seed;
        if (!committed && !transformLives.has(petal)) {
          petal.nx += (target.x - petal.nx) * cue.motion * pull * 0.025;
          petal.ny += (target.y - petal.ny) * cue.motion * pull * 0.025;
          const distance = Math.hypot(target.x - petal.nx, target.y - petal.ny);
          if (cue.mode === 'petal-transform') petal.lifeScale = Math.max(0.05, Math.min(1, distance / (0.028 * Math.max(0.8, target.scale))));
          if (cue.mode === 'petal-transform' && distance < 0.006 * Math.max(0.8, target.scale)) {
            const respawnMin = getP9EffectValue(id, 'respawnMin', 1);
            const respawnMax = getP9EffectValue(id, 'respawnMax', 3);
            transformLives.set(petal, { state: 'dormant', respawnAt: now + respawnMin + hash(cue.voice.seed + index * 19) * (respawnMax - respawnMin), fadeAt: 0, fadeDuration: getP9EffectValue(id, 'fadeIn', 0.8), seed: cue.voice.seed + index * 101 });
            transformCommits.set(petal, cue.voice.seed); petal.lifeAlpha = 0; petal.lifeScale = 0.05;
            if (cue.voice.commitProgress < 0) cue.voice.commitProgress = cue.progress;
          }
        }
      }
      if (cue.mode === 'petal-burst' && chosen && transformCommits.get(petal) !== cue.voice.seed && !transformLives.has(petal)) {
        const field = burstFields.get(cue.voice.seed) ?? { expiresAt: now + cue.voice.effect.duration + 0.5, points: [] };
        field.points.push([petal.nx * 2 - 1, 1 - petal.ny * 2]); burstFields.set(cue.voice.seed, field);
        const respawnMin = getP9EffectValue(id, 'respawnMin', 3), respawnMax = getP9EffectValue(id, 'respawnMax', 7);
        transformLives.set(petal, { state: 'dormant', respawnAt: now + respawnMin + hash(cue.voice.seed + index * 19) * (respawnMax - respawnMin), fadeAt: 0, fadeDuration: getP9EffectValue(id, 'fadeIn', 0.8), seed: cue.voice.seed + index * 101 });
        transformCommits.set(petal, cue.voice.seed); petal.lifeAlpha = 0; petal.lifeScale = 0.05;
      }
      if (cue.mode === 'petal-stitch' && chosen) {
        const partner = petals[(index + 3) % petals.length];
        const tension = getP9EffectValue(id, 'tension', 1.15);
        petal.nx += (partner.nx - petal.nx) * cue.motion * tension * 0.006;
        petal.ny += (partner.ny - petal.ny) * cue.motion * tension * 0.006;
      }
      if (cue.mode === 'petal-stretch' && chosen && cue.progress > 0.92) {
        const marker = cue.voice.seed * 1000 + index;
        if (stretchCommits.get(petal) !== marker) {
          petal.nx = 0.08 + hash(marker * 31) * 0.84;
          petal.ny = 0.1 + hash(marker * 37) * 0.8;
          petal.vx = 0; petal.vy = 0; stretchCommits.set(petal, marker);
        }
      }
    }
  }
  const forces = [...frame.lanes.water, ...frame.lanes.scene].filter((cue) =>
    ['directional-wave', 'shared-force'].includes(cue.mode));
  for (const force of forces) {
    for (const petal of petals) {
      if (force.mode === 'directional-wave') {
        const wave = externalWave(force.voice.angle, force.progress * force.motionScale, petal.nx, petal.ny);
        petal.vx += wave.x * wave.front * force.motion * 0.00034;
        petal.vy += wave.y * wave.front * force.motion * 0.00034;
        continue;
      }
      const scatter = (hash(petal.phase * 17 + force.voice.seed) - 0.5) * getP9FamilyValue('scene', 'scatter', 0.7);
      const angle = force.voice.angle + scatter;
      const strength = force.mode === 'shared-force' ? getP9EffectValue(force.voice.effect.id, 'force', 0.9)
        : getP9EffectValue(force.voice.effect.id, 'pressure', 1);
      const amount = force.motion * strength * (0.0001 + hash(petal.phase * 23) * 0.00016);
      petal.vx += Math.cos(angle) * amount;
      petal.vy += Math.sin(angle) * amount;
    }
  }
}
