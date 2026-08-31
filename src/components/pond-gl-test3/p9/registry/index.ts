import { P9_ECLIPSE_EFFECTS } from './lane-eclipse';
import { P9_MOTE_EFFECTS } from './lane-motes';
import { P9_PETAL_EFFECTS } from './lane-petals';
import { P9_WATER_EFFECTS } from './lane-water';
import { P9_SCENE_EFFECTS } from './lane-scene';
import { P9_PARAM_META, type P9ParamDefinition } from './p9-params';
import type { P9EffectDefinition } from './p9-types';

export type { P9ParamDefinition } from './p9-params';
export type { P9Accent, P9Channels, P9EffectDefinition, P9Lane, P9Mode, P9Retrigger } from './p9-types';

export const P9_EFFECTS: readonly P9EffectDefinition[] = [
  ...P9_ECLIPSE_EFFECTS,
  ...P9_MOTE_EFFECTS,
  ...P9_PETAL_EFFECTS,
  ...P9_WATER_EFFECTS,
  ...P9_SCENE_EFFECTS,
].sort((a, b) => a.number - b.number);

if (P9_EFFECTS.length !== 33 || new Set(P9_EFFECTS.map((effect) => effect.id)).size !== 33) {
  throw new Error('[P9] 生产注册表必须恰好包含 33 个唯一效果');
}

export const P9_ACTIVE_EFFECTS = P9_EFFECTS;
const EFFECT_BY_SOUND_KEY = new Map(P9_ACTIVE_EFFECTS.map((effect) => [effect.soundKey, effect]));
if (P9_ACTIVE_EFFECTS.length !== 33 || EFFECT_BY_SOUND_KEY.size !== 33) {
  throw new Error('[P9] v4 必须恰好包含 33 个唯一 sound key');
}

export function getP9ParamMeta(effect: P9EffectDefinition): readonly P9ParamDefinition[] {
  return P9_PARAM_META[effect.number] ?? [];
}

/** 大写、Shift 与 Caps Lock 全部归一到同一个声音键和同一个动画。 */
export function findP9Effect(audioKey: string): P9EffectDefinition | null {
  return EFFECT_BY_SOUND_KEY.get(audioKey.toLowerCase()) ?? null;
}
