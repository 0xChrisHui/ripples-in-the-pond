'use client';

import { P9_EFFECTS, getP9ParamMeta, type P9Lane } from '../registry';
import { P9_FAMILY_META } from './p9-tuning-meta';

const STORAGE_KEY = 'ripples:p9-v4-1-tuning';
const PRIOR_STORAGE_KEY = 'ripples:p9-v4-tuning';
const LEGACY_KEYS = ['ripples:p9-v3-tuning', 'ripples:p9-v2-tuning'];
const V4_DEFAULT_KEYS = new Set([
  'FX01.amount', 'FX01.hitGain', 'FX03.brightness', 'FX04.radius', 'FX04.softness',
  'FX07.shrink', 'FX09.motion', 'FX09.brightness', 'FX10.fadeOut', 'FX10.hold',
  'FX10.fadeIn', 'FX11.transition', 'FX11.hold', 'FX12.brightness', 'FX12.hitGain',
  'FX15.speed', 'FX15.scatter', 'FX17.count', 'FX17.pull', 'FX23.gain',
  'FX23.ceiling', 'FX24.strength', 'FX41.shade', 'FX42.film', 'FX05.brightness',
  'FX30.tension',
]);

export interface P9TuningState {
  family: Record<P9Lane, Record<string, number>>;
  effects: Record<string, Record<string, number>>;
  revision: number;
}

const lanes: P9Lane[] = ['eclipse', 'motes', 'petals', 'water', 'scene'];

function defaults(): P9TuningState {
  const family = {} as P9TuningState['family'];
  for (const lane of lanes) {
    family[lane] = Object.fromEntries(P9_FAMILY_META[lane].map((item) => [item.key, item.initial]));
  }
  const effects = Object.fromEntries(P9_EFFECTS.map((effect) => [
    effect.id, Object.fromEntries(getP9ParamMeta(effect).map((item) => [item.key, item.initial])),
  ]));
  return { family, effects, revision: 0 };
}

let state = defaults();
const listeners = new Set<() => void>();

function publish(next: P9TuningState): void {
  state = { ...next, revision: state.revision + 1 };
  for (const listener of listeners) listener();
}

function mergeSaved(raw: unknown, legacy = false): P9TuningState {
  const next = defaults();
  if (!raw || typeof raw !== 'object') return next;
  const saved = raw as Partial<P9TuningState>;
  for (const lane of lanes) {
    const values = saved.family?.[lane];
    if (!values) continue;
    for (const item of P9_FAMILY_META[lane]) {
      const value = values[item.key];
      if (typeof value === 'number' && Number.isFinite(value)) next.family[lane][item.key] = value;
    }
  }
  for (const effect of P9_EFFECTS) {
    const values = saved.effects?.[effect.id];
    if (!values) continue;
    for (const item of getP9ParamMeta(effect)) {
      const value = values[item.key];
      if (legacy && V4_DEFAULT_KEYS.has(`${effect.id}.${item.key}`)) continue;
      if (typeof value === 'number' && Number.isFinite(value)) next.effects[effect.id][item.key] = value;
    }
  }
  return next;
}

export function loadP9Tuning(): void {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const prior = current ? null : localStorage.getItem(PRIOR_STORAGE_KEY);
    const legacy = current || prior ? null : LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) ?? null;
    publish(current ? mergeSaved(JSON.parse(current))
      : prior ? mergeSaved(JSON.parse(prior))
        : legacy ? mergeSaved(JSON.parse(legacy), true) : defaults());
    if (prior || legacy) localStorage.setItem(STORAGE_KEY, JSON.stringify({ family: state.family, effects: state.effects }));
  } catch (error) {
    console.error('[P9] 读取调参存档失败，已回到默认值', error);
    publish(defaults());
  }
}

export function saveP9Tuning(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ family: state.family, effects: state.effects }));
  } catch (error) {
    console.error('[P9] 保存调参存档失败', error);
  }
}

export function resetP9Tuning(): void {
  publish(defaults());
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PRIOR_STORAGE_KEY);
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}

export function setP9FamilyValue(lane: P9Lane, key: string, value: number): void {
  publish({ ...state, family: { ...state.family, [lane]: { ...state.family[lane], [key]: value } } });
}

export function setP9EffectValue(effectId: string, key: string, value: number): void {
  publish({ ...state, effects: { ...state.effects, [effectId]: { ...state.effects[effectId], [key]: value } } });
}

export function getP9FamilyValue(lane: P9Lane, key: string, fallback = 1): number {
  return state.family[lane]?.[key] ?? fallback;
}

export function getP9EffectValue(effectId: string, key: string, fallback = 1): number {
  return state.effects[effectId]?.[key] ?? fallback;
}

export function getP9TuningSnapshot(): P9TuningState { return state; }
export function subscribeP9Tuning(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
