import { getP9Mode, getP9Modes, type P9Frame } from '../runtime/p9-sampler';
import { getP9EffectValue, getP9FamilyValue } from '../tuning/p9-tuning-store';

export interface P9WaterUniform {
  wave: [number, number, number, number];
  arcs: readonly [number, number, number, number][];
  caustic: [number, number, number, number];
}

export function getP9WaterUniform(frame: P9Frame): P9WaterUniform {
  const arcs = getP9Modes(frame, 'directional-wave').slice(-5);
  const quietVoices = getP9Modes(frame, 'quiet-wave');
  const quiet = quietVoices[quietVoices.length - 1] ?? null;
  const bright = getP9Mode(frame, 'caustic-bright');
  const darks = getP9Modes(frame, 'caustic-dark');
  const current = getP9Mode(frame, 'shared-force');
  const waveGain = getP9FamilyValue('water', 'waveStrength', 1);
  const causticGain = getP9FamilyValue('water', 'causticGain', 1);
  return {
    wave: [
      0, 0, 0,
      quiet ? quiet.voice.seed % 8 : 0,
    ],
    arcs: arcs.map((arc) => [
      arc.motion * getP9EffectValue('FX20', 'strength', 1) * waveGain,
      arc.progress * arc.motionScale,
      arc.voice.angle,
      0,
    ]),
    caustic: [
      (current?.energy ?? 0) * 0.08 * causticGain,
      current?.progress ?? 0,
      (bright?.energy ?? 0) * getP9EffectValue('FX23', 'gain', 0.2) * causticGain,
      darks.reduce((sum, dark) => sum + dark.energy, 0) * getP9EffectValue('FX24', 'strength', 0.75) * causticGain,
    ],
  };
}

export function getP9QuietWaves(frame: P9Frame) {
  const voices = getP9Modes(frame, 'quiet-wave');
  return voices.slice(-5).map((cue) => ({
    x: 0.5 + Math.cos(cue.voice.angle) * 0.28,
    y: 0.5 + Math.sin(cue.voice.angle) * 0.28,
    progress: cue.progress * cue.motionScale,
    energy: cue.energy * getP9EffectValue('FX32', 'calm', 0.82),
  }));
}
