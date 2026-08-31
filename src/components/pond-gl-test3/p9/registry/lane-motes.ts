import { defineP9Effect } from './p9-types';

export const P9_MOTE_EFFECTS = [
  defineP9Effect(9, '微光群闪耀', 'motes', 'motes-sparkle'),
  defineP9Effect(10, '微光群熄灭', 'motes', 'motes-extinguish', { duration: 1.25, retrigger: 'object-cycle' }),
  defineP9Effect(11, '微光变色', 'motes', 'motes-hue', { duration: 4, retrigger: 'palette-cycle' }),
  defineP9Effect(12, '局部强闪', 'motes', 'motes-flash', { accent: 'environment' }),
  defineP9Effect(13, '微光汇入日食', 'motes', 'motes-ingest', { duration: 3.4, retrigger: 'one-way-commit', requiresEclipse: true }),
  defineP9Effect(44, '微光群落', 'motes', 'motes-colony', { duration: 4.5, soundKey: '5', retrigger: 'spawn-batch' }),
] as const;
