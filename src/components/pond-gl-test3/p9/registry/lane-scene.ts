import { defineP9Effect } from './p9-types';

export const P9_SCENE_EFFECTS = [
  defineP9Effect(36, '全场共享力场', 'scene', 'shared-force', { accent: 'environment', soundKey: '4', retrigger: 'bounded-envelope' }),
  defineP9Effect(38, '多向折射扫掠', 'scene', 'screen-sweep', { accent: 'environment', retrigger: 'spawn-batch', soundKey: 'space' }),
  defineP9Effect(41, '暗月过境', 'scene', 'moon-transit', { duration: 4.4, soundKey: 'h', retrigger: 'bounded-envelope' }),
  defineP9Effect(42, '全屏白色潮膜', 'scene', 'milk-film', { duration: 2.66, soundKey: '3', retrigger: 'bounded-envelope' }),
  defineP9Effect(43, '明暗反相前线', 'scene', 'light-inversion', { retrigger: 'spawn-batch', soundKey: '8' }),
] as const;
