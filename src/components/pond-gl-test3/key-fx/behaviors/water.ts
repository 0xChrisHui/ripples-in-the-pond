import type { KeyFxBehavior } from '../key-fx-types';

/** 上一轮五种水体行为：保留原来的声学性格，但共享新版 voice 与日食编舞。 */
export const pressureBehavior: KeyFxBehavior = {
  family: 'pressure', duration: 2.8, mergeWindow: 0.48, fieldRadius: 0.15,
  channels: { motes: 0.08, water: 0.72, halo: 0.12, petals: 0.1 },
  ripples: [
    { at: 0, dx: 0, dy: 0, radius: 0.09, strength: -0.024 },
    { at: 0.2, dx: 0.004, dy: -0.003, radius: 0.12, strength: -0.016 },
    { at: 0.48, dx: -0.005, dy: 0.004, radius: 0.15, strength: -0.009 },
  ],
};

export const resonanceBehavior: KeyFxBehavior = {
  family: 'resonance', duration: 3.4, mergeWindow: 0.55, fieldRadius: 0.16,
  channels: { motes: 0.02, water: 0.64, halo: 0.16, petals: 0 },
  ripples: [
    { at: 0, dx: 0, dy: 0, radius: 0.052, strength: 0.15 },
    { at: 0.17, dx: 0.085, dy: -0.032, radius: 0.041, strength: 0.1 },
    { at: 0.4, dx: -0.064, dy: 0.072, radius: 0.046, strength: 0.085 },
    { at: 0.72, dx: 0.014, dy: 0.008, radius: 0.061, strength: -0.045 },
  ],
};

export const shearBehavior: KeyFxBehavior = {
  family: 'shear', duration: 2.2, mergeWindow: 0.16, fieldRadius: 0.2,
  channels: { motes: 0.16, water: 0.58, halo: 0, petals: 0.72 },
  ripples: [
    { at: 0, dx: -0.12, dy: 0.08, radius: 0.026, strength: 0.22 },
    { at: 0.1, dx: -0.04, dy: 0.03, radius: 0.024, strength: 0.2 },
    { at: 0.2, dx: 0.04, dy: -0.02, radius: 0.022, strength: 0.18 },
    { at: 0.31, dx: 0.12, dy: -0.07, radius: 0.02, strength: 0.15 },
  ],
};

export const motesBehavior: KeyFxBehavior = {
  family: 'motes', duration: 4, mergeWindow: 0.32, fieldRadius: 0.24,
  channels: { motes: 1, water: 0.14, halo: 0.12, petals: 0.03 },
  ripples: [
    { at: 0, dx: 0, dy: 0, radius: 0.17, strength: 0.055 },
    { at: 1.15, dx: 0.015, dy: -0.01, radius: 0.21, strength: 0.038 },
    { at: 2.45, dx: -0.012, dy: 0.008, radius: 0.25, strength: 0.022 },
  ],
};

export const capillaryBehavior: KeyFxBehavior = {
  family: 'capillary', duration: 1.8, mergeWindow: 0.14, fieldRadius: 0.1,
  channels: { motes: 0.12, water: 0.82, halo: 0.025, petals: 0 },
  ripples: [
    { at: 0, dx: 0, dy: 0, radius: 0.018, strength: 0.13 },
    { at: 0.06, dx: 0.026, dy: -0.018, radius: 0.014, strength: 0.1 },
    { at: 0.13, dx: -0.022, dy: 0.024, radius: 0.012, strength: 0.085 },
    { at: 0.22, dx: 0.038, dy: 0.017, radius: 0.011, strength: 0.07 },
  ],
};
