import type { KeyFxBehavior } from '../key-fx-types';

/** C：振动从中央按距离依次抵达球群，水面只留一个起点。 */
export const relayBehavior: KeyFxBehavior = {
  family: 'relay', duration: 2.6, mergeWindow: 0.5, fieldRadius: 0.62,
  channels: { motes: 0.04, water: 0.08, halo: 0.12, petals: 0 },
  ripples: [{ at: 0, dx: 0, dy: 0, radius: 0.035, strength: 0.07 }],
};
