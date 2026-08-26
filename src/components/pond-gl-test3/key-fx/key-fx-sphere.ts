import { KEY_FX_BEHAVIORS } from './key-fx-behaviors';
import { getKeyFxPulses, sampleKeyFxPulse } from './key-fx-state';

export interface SphereKeyFx {
  dx: number;
  dy: number;
  scale: number;
  halo: number;
  excite: number;
}

/** 新五键让球体读取同一局部场；旧五键仍以水体行为为主。 */
export function sampleSphereKeyFx(now: number, x: number, y: number): SphereKeyFx {
  const out: SphereKeyFx = { dx: 0, dy: 0, scale: 1, halo: 0, excite: 0 };
  for (const pulse of getKeyFxPulses(now)) {
    const behavior = KEY_FX_BEHAVIORS[pulse.family];
    const rx = x - pulse.x, ry = y - (1 - pulse.y);
    const dist = Math.hypot(rx, ry);
    const base = Math.pow(Math.max(0, 1 - dist / behavior.fieldRadius), 2);
    if (base <= 0) continue;
    const energy = sampleKeyFxPulse(pulse, now);
    const w = base * energy;
    const age = now - pulse.startedAt;
    if (pulse.family === 'sink') {
      out.dy += w * 0.014; out.scale -= w * 0.08; out.excite += w * 0.18;
    } else if (pulse.family === 'relay') {
      const phase = age - dist * 1.5;
      const relay = phase > 0 && phase < 0.5 ? Math.sin((phase / 0.5) * Math.PI) * base : 0;
      out.scale += relay * 0.1; out.halo += relay * 0.16; out.excite += relay * 0.35;
    } else if (pulse.family === 'dew') {
      out.halo += w * 0.2;
    } else if (pulse.family === 'lift') {
      out.dy -= w * 0.02; out.scale += w * 0.045; out.halo += w * 0.06;
    }
  }
  out.scale = Math.max(0.9, Math.min(1.12, out.scale));
  return out;
}
