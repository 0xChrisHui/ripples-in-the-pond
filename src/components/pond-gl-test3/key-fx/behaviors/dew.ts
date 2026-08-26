import type { KeyFxBehavior } from '../key-fx-types';

/** F：微光向局部球缘凝聚，随后自然释放回池塘。 */
export const dewBehavior: KeyFxBehavior = {
  family: 'dew',
  duration: 4,
  mergeWindow: 0.32,
  fieldRadius: 0.24,
  channels: {
    motes: 1,
    water: 0.04,
    halo: 0.08,
    petals: 0.03,
  },
  ripples: [
    { at: 0.35, dx: 0, dy: 0, radius: 0.12, strength: 0.016 },
  ],
};
