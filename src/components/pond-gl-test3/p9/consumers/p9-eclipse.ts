import { getP9EffectValue, getP9FamilyValue } from '../tuning/p9-tuning-store';
import type { P9Frame, P9VoiceFrame } from '../runtime/p9-sampler';
import { mixHex, paletteColor } from '../runtime/p9-visual-math';

export interface P9EclipsePose {
  coreX: number; coreY: number; coreScale: number; ringScale: number;
  ringWidth: number; haloScale: number; haloOpacity: number; rotation: number;
  haloBlur: number; hueColor: string; hueStrength: number; echo: number;
}

const basePose = (): P9EclipsePose => ({
  coreX: 0, coreY: 0, coreScale: 1, ringScale: 1, ringWidth: 1.2,
  haloScale: 1, haloOpacity: 0.82, haloBlur: 0, rotation: 0, hueColor: '#ffffff', hueStrength: 0, echo: 0,
});

function applyEclipse(pose: P9EclipsePose, cue: P9VoiceFrame): void {
  const id = cue.voice.effect.id;
  const pulse = ['smooth-accumulate', 'velocity-impulse'].includes(cue.voice.effect.retrigger)
    ? cue.motion : Math.sin(cue.progress * Math.PI) * cue.motion;
  const angle = cue.voice.angle;
  if (cue.mode === 'ring-expand') {
    pose.ringScale += pulse * getP9EffectValue(id, 'amount', 0.8);
  }
  if (cue.mode === 'ring-flash') {
    pose.ringWidth += cue.energy * getP9EffectValue(id, 'brightness', 1.1) * 4.8;
  }
  if (cue.mode === 'halo-expand') {
    pose.haloScale += pulse * getP9EffectValue(id, 'radius', 0.72);
    pose.haloBlur += cue.energy * getP9EffectValue(id, 'softness', 0.65) * 2.5;
  }
  if (cue.mode === 'lens-orbit') {
    pose.ringScale += pulse * 0.06;
    pose.rotation -= cue.progress * getP9EffectValue(id, 'speed', 1.2) * 24;
    pose.echo = Math.max(pose.echo, cue.energy * 0.14);
  }
  if (cue.mode === 'halo-hue') {
    const colorMix = getP9EffectValue(id, 'colorMix', 0.85);
    pose.hueColor = mixHex(pose.hueColor, paletteColor(cue.palettePosition), Math.min(1, cue.energy) * colorMix);
    pose.hueStrength += cue.energy * colorMix * getP9EffectValue(id, 'vividness', 7.5);
    pose.haloOpacity += cue.energy * 0.14 * colorMix;
  }
  if (cue.mode === 'core-shrink') {
    pose.coreScale -= pulse * getP9EffectValue(id, 'shrink', 0.42);
  }
  if (cue.mode === 'eclipse-dual') {
    const amount = getP9EffectValue(id, 'amount', 1.25);
    pose.coreX += Math.cos(angle) * pulse * 22 * amount;
    pose.coreY += Math.sin(angle) * pulse * 16 * amount;
    pose.rotation += pulse * 20 * amount;
    pose.echo = Math.max(pose.echo, pulse * 0.35);
  }
  if (cue.mode === 'elastic-return') {
    const pull = getP9EffectValue(id, 'pull', 1.3);
    pose.coreX += Math.cos(angle) * pulse * 18 * pull;
    pose.coreY += Math.sin(angle) * pulse * 8 * pull;
    pose.coreScale += Math.sin(cue.progress * Math.PI * 3) * cue.motion * 0.16;
    pose.ringScale += pulse * 0.18;
  }
}

/** 把所有同族声部相加；跨族环境力只提供轻微位移，不改月光强度。 */
export function sampleP9EclipsePose(frame: P9Frame): P9EclipsePose {
  const pose = basePose();
  for (const cue of frame.lanes.eclipse) applyEclipse(pose, cue);
  for (const cue of [...frame.lanes.water, ...frame.lanes.scene]) {
    if (cue.mode !== 'shared-force') continue;
    const pulse = Math.sin(cue.progress * Math.PI) * cue.motion;
    pose.coreX += Math.cos(cue.voice.angle) * pulse * 8;
    pose.coreY += Math.sin(cue.voice.angle) * pulse * 8;
    pose.haloScale += pulse * 0.08;
  }
  for (const cue of frame.lanes.motes) {
    if (cue.mode === 'motes-ingest') {
      const arrival = Math.sin(Math.max(0, cue.progress - 0.62) / 0.38 * Math.PI);
      pose.ringWidth += Math.max(0, arrival) * getP9EffectValue(cue.voice.effect.id, 'ringFlash', 0.28) * 8;
      pose.haloOpacity += Math.max(0, arrival) * 0.12;
    }
  }
  const scale = getP9FamilyValue('eclipse', 'core', 1);
  pose.coreScale = 1 + (pose.coreScale - 1) * scale;
  pose.ringScale = 1 + (pose.ringScale - 1) * getP9FamilyValue('eclipse', 'ring', 1);
  pose.haloScale = 1 + (pose.haloScale - 1) * getP9FamilyValue('eclipse', 'halo', 1);
  return pose;
}
