import type { KeyFxBehavior } from '../key-fx-types';

/** B：低频先压低邻近球体，水面只承接两次宽缓沉降。 */
export const sinkBehavior: KeyFxBehavior = {
  family: 'sink', duration: 2.8, mergeWindow: 0.46, fieldRadius: 0.26,
  channels: { motes: 0.06, water: 0.32, halo: 0.06, petals: 0 },
  ripples: [
    { at: 0.08, dx: 0, dy: 0, radius: 0.12, strength: -0.018 },
    { at: 0.42, dx: 0.008, dy: -0.006, radius: 0.17, strength: -0.009 },
  ],
};
