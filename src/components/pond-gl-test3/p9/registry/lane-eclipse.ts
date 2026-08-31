import { defineP9Effect } from './p9-types';

export const P9_ECLIPSE_EFFECTS = [
  defineP9Effect(1, '白环扩张', 'eclipse', 'ring-expand', { retrigger: 'velocity-impulse' }),
  defineP9Effect(2, '孢子喷发', 'eclipse', 'spore-burst', { retrigger: 'spawn-batch' }),
  defineP9Effect(3, '白环骤亮', 'eclipse', 'ring-flash', { accent: 'environment' }),
  defineP9Effect(4, '光晕扩散', 'eclipse', 'halo-expand', { retrigger: 'velocity-impulse' }),
  defineP9Effect(5, '引力透镜轨道', 'eclipse', 'lens-orbit'),
  defineP9Effect(6, '光晕变色', 'eclipse', 'halo-hue', { retrigger: 'palette-cycle' }),
  defineP9Effect(7, '黑核收缩', 'eclipse', 'core-shrink'),
  defineP9Effect(25, '黑盘偏心', 'eclipse', 'eclipse-dual', { duration: 3.6, retrigger: 'velocity-impulse' }),
  defineP9Effect(35, '弹性回返', 'eclipse', 'elastic-return', { duration: 3.4, soundKey: '6', retrigger: 'bounded-envelope' }),
] as const;
