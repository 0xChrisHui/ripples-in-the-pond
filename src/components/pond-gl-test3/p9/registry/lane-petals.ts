import { defineP9Effect } from './p9-types';

export const P9_PETAL_EFFECTS = [
  defineP9Effect(14, '花瓣增殖', 'petals', 'petal-multiply', { duration: 8, retrigger: 'object-cycle' }),
  defineP9Effect(15, '花瓣疾行', 'petals', 'petal-sprint', { duration: 4 }),
  defineP9Effect(17, '花瓣汇入日食', 'petals', 'petal-ingest', { duration: 3.4, retrigger: 'object-cycle', requiresEclipse: true }),
  defineP9Effect(18, '花瓣原地炸裂', 'petals', 'petal-burst', { duration: 3.6, retrigger: 'object-cycle' }),
  defineP9Effect(19, '花瓣拉丝断裂', 'petals', 'petal-stretch', { duration: 6, retrigger: 'spawn-batch' }),
  defineP9Effect(30, '花瓣邻接缝合', 'petals', 'petal-stitch', { duration: 3.8, retrigger: 'object-cycle', soundKey: '7' }),
  defineP9Effect(31, '花瓣物质转化', 'petals', 'petal-transform', { duration: 3.6, retrigger: 'one-way-commit', soundKey: 'p', requiresEclipse: true }),
  defineP9Effect(39, '流动弧线描摹', 'petals', 'draw-erase', { duration: 3.4, retrigger: 'spawn-batch', soundKey: 'z', requiresEclipse: true }),
] as const;
