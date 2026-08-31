export type P9Lane = 'eclipse' | 'motes' | 'petals' | 'water' | 'scene';
export type P9Accent = 'local' | 'environment' | 'global';
export type P9Retrigger = 'smooth-accumulate' | 'velocity-impulse' | 'spawn-batch'
  | 'object-cycle' | 'palette-cycle' | 'one-way-commit' | 'bounded-envelope';

export type P9Mode =
  | 'ring-expand' | 'spore-burst' | 'ring-flash' | 'halo-expand'
  | 'lens-orbit' | 'halo-hue' | 'core-shrink'
  | 'motes-sparkle' | 'motes-extinguish' | 'motes-hue' | 'motes-flash'
  | 'motes-ingest' | 'petal-multiply' | 'petal-sprint'
  | 'petal-ingest' | 'petal-burst' | 'petal-stretch' | 'directional-wave'
  | 'droplet' | 'caustic-bright' | 'caustic-dark' | 'eclipse-dual'
  | 'petal-stitch' | 'petal-transform' | 'quiet-wave' | 'elastic-return'
  | 'shared-force' | 'screen-sweep' | 'draw-erase' | 'moon-transit'
  | 'milk-film' | 'light-inversion' | 'motes-colony';

export interface P9Channels {
  eclipse: number;
  motes: number;
  petals: number;
  water: number;
  moon: number;
  global: number;
}

export interface P9EffectDefinition {
  id: `FX${string}`;
  number: number;
  soundKey: string;
  name: string;
  lane: P9Lane;
  mode: P9Mode;
  accent: P9Accent;
  duration: number;
  channels: P9Channels;
  moonWrite: boolean;
  waterWrite: boolean;
  requiresEclipse: boolean;
  retrigger: P9Retrigger;
}

const LANE_CHANNELS: Readonly<Record<P9Lane, P9Channels>> = {
  eclipse: { eclipse: 1, motes: 0.08, petals: 0, water: 0, moon: 0, global: 0 },
  motes: { eclipse: 0.08, motes: 1, petals: 0, water: 0, moon: 0, global: 0 },
  petals: { eclipse: 0.05, motes: 0.05, petals: 1, water: 0, moon: 0, global: 0 },
  water: { eclipse: 0, motes: 0, petals: 0.05, water: 1, moon: 0, global: 0 },
  scene: { eclipse: 0.2, motes: 0.2, petals: 0.12, water: 0.25, moon: 0, global: 1 },
};

/** 编号决定正式键位，避免注册表手写键位后悄悄错位。 */
export function defineP9Effect(
  number: number,
  name: string,
  lane: P9Lane,
  mode: P9Mode,
  options: {
    duration?: number; accent?: P9Accent; channels?: Partial<P9Channels>;
    moonWrite?: boolean; waterWrite?: boolean; retrigger?: P9Retrigger;
    soundKey?: string; requiresEclipse?: boolean;
  } = {},
): P9EffectDefinition {
  const shifted = number > 26;
  const keyIndex = shifted ? number - 26 : number;
  const base = LANE_CHANNELS[lane];
  return {
    id: `FX${String(number).padStart(2, '0')}`,
    number,
    soundKey: options.soundKey ?? String.fromCharCode(96 + keyIndex),
    name,
    lane,
    mode,
    accent: options.accent ?? (lane === 'scene' ? 'global' : lane === 'water' ? 'environment' : 'local'),
    duration: options.duration ?? (lane === 'scene' ? 3.8 : 2.8),
    channels: { ...base, ...options.channels },
    moonWrite: options.moonWrite ?? false,
    waterWrite: options.waterWrite ?? false,
    requiresEclipse: options.requiresEclipse ?? lane === 'eclipse',
    retrigger: options.retrigger ?? 'smooth-accumulate',
  };
}
