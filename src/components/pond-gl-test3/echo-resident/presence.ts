import type { ResidentEchoConfig, ResidentEchoPhase, ResidentPresenceState, ResidentRandomStream } from '../../../types/echo-resident';
import { sampleRange } from './random';
import { smootherStep } from './motion';

export function createPresenceState(c: ResidentEchoConfig, random: ResidentRandomStream): ResidentPresenceState {
  return { phase: 'waiting', elapsed: 0, duration: sampleRange(random, c.firstDelaySeconds), presence: 0, heldPresence: null };
}
function enter(s: ResidentPresenceState, phase: ResidentEchoPhase, c: ResidentEchoConfig, random: ResidentRandomStream): void {
  s.phase = phase; s.elapsed = 0;
  const range = phase === 'fading_in' ? c.fadeInSeconds : phase === 'visible' ? c.visibleSeconds
    : phase === 'fading_out' ? c.fadeOutSeconds : c.hiddenSeconds;
  s.duration = sampleRange(random, range);
}
/** 暂停期限与透明度恢复分开，交互不会直接把半透明球瞬间改为不透明。 */
export function stepPresence(s: ResidentPresenceState, delta: number, held: boolean, reduced: boolean,
  c: ResidentEchoConfig, random: ResidentRandomStream): void {
  if (reduced) { s.presence = 1; s.heldPresence = 1; return; }
  if (held) {
    if (s.heldPresence === null) s.heldPresence = s.presence;
    s.presence = Math.min(1, s.presence + delta / 0.3);
    return;
  }
  if (s.heldPresence !== null) {
    if (s.phase !== 'visible') enter(s, 'visible', c, random);
    s.duration = Math.max(s.duration, s.elapsed + 3);
    s.heldPresence = null;
  }
  s.elapsed += delta;
  if (s.elapsed >= s.duration) {
    const remainder = s.elapsed - s.duration;
    const next = s.phase === 'waiting' || s.phase === 'hidden' ? 'fading_in'
      : s.phase === 'fading_in' ? 'visible' : s.phase === 'visible' ? 'fading_out' : 'hidden';
    enter(s, next, c, random); s.elapsed = remainder;
  }
  const u = smootherStep(s.elapsed / s.duration);
  s.presence = s.phase === 'visible' ? 1 : s.phase === 'fading_in' ? u : s.phase === 'fading_out' ? 1 - u : 0;
}
