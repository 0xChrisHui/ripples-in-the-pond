import { defineP9Effect } from './p9-types';

export const P9_WATER_EFFECTS = [
  defineP9Effect(20, '屏外巨圆弧浪', 'water', 'directional-wave', { waterWrite: true, retrigger: 'spawn-batch' }),
  defineP9Effect(21, '水滴涟漪', 'water', 'droplet', { waterWrite: true }),
  defineP9Effect(23, '焦散增亮', 'water', 'caustic-bright', { accent: 'environment', retrigger: 'velocity-impulse' }),
  defineP9Effect(24, '焦散退暗', 'water', 'caustic-dark', { duration: 1.68, retrigger: 'bounded-envelope' }),
  defineP9Effect(32, '白色静浪', 'water', 'quiet-wave', { duration: 4.2, waterWrite: true, retrigger: 'spawn-batch', soundKey: 'v' }),
] as const;
