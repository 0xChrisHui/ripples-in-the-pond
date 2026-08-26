import type { KeyFxBehavior } from '../key-fx-types';

/** D：方向性暗流穿过花瓣层，水面只留下极轻的行进线索。 */
export const petalsBehavior: KeyFxBehavior = {
  family: 'petals', duration: 2.4, mergeWindow: 0.22, fieldRadius: 0.4,
  channels: { motes: 0.08, water: 0.12, halo: 0, petals: 1 },
  ripples: [
    { at: 0, dx: -0.1, dy: 0.06, radius: 0.022, strength: 0.075 },
    { at: 0.12, dx: 0, dy: 0, radius: 0.019, strength: 0.06 },
    { at: 0.26, dx: 0.1, dy: -0.06, radius: 0.016, strength: 0.045 },
  ],
};
