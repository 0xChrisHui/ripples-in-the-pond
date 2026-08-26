import type { KeyFxBehavior } from '../key-fx-types';

/** O：局部空间向上抽离，球与微光短暂脱离原深度。 */
export const liftBehavior: KeyFxBehavior = {
  family: 'lift', duration: 1.8, mergeWindow: 0.2, fieldRadius: 0.42,
  channels: { motes: 0.35, water: 0.06, halo: 0.05, petals: 0 },
  ripples: [{ at: 0.2, dx: 0, dy: 0.03, radius: 0.055, strength: -0.006 }],
};
