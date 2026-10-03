import type { ResidentEchoConfig, ResidentEchoFrameInput, ResidentEchoInteraction, ResidentRandomStream } from '../../../../types/echo-resident';
import { sampleRange } from '../random';

export type ResidentLocks = {
  interaction: ResidentEchoInteraction; previousInteraction: boolean; previousPlayback: boolean;
  waitingForScene: boolean; interactionProtection: number; playbackProtection: number;
  ramp: { from: number; to: number; elapsed: number; duration: number }; gain: number;
};
export function createLocks(): ResidentLocks {
  return { interaction: { hovered: false, focused: false, pointerDown: false },
    previousInteraction: false, previousPlayback: false, waitingForScene: false,
    interactionProtection: 0, playbackProtection: 0,
    ramp: { from: 1, to: 1, elapsed: 0, duration: 1 }, gain: 1 };
}
const primitive = (u: number) => u ** 6 - 3 * u ** 5 + 2.5 * u ** 4;
function rampDelta(s: ResidentLocks, delta: number, target: number, c: ResidentEchoConfig, random: ResidentRandomStream): number {
  if (s.ramp.to !== target) s.ramp = { from: s.gain, to: target, elapsed: 0,
    duration: sampleRange(random, c.resumeSeconds) };
  const r = s.ramp, a = Math.min(1, r.elapsed / r.duration);
  r.elapsed += delta;
  const b = Math.min(1, r.elapsed / r.duration);
  const interval = (b - a) * r.duration;
  const weighted = r.from * interval + (r.to - r.from) * r.duration * (primitive(b) - primitive(a))
    + Math.max(0, delta - interval) * r.to;
  const smooth = b ** 3 * (b * (b * 6 - 15) + 10);
  s.gain = r.from + (r.to - r.from) * smooth;
  return weighted;
}
/** 暂停仍属于播放锁；释放后必须收到场景恢复信号，才能推进保护时钟。 */
export function stepLocks(s: ResidentLocks, frame: ResidentEchoFrameInput, pending: boolean,
  delta: number, c: ResidentEchoConfig, random: ResidentRandomStream) {
  const interacted = s.interaction.hovered || s.interaction.focused || s.interaction.pointerDown;
  const playback = pending || (!frame.otherPlaybackActive && ['loading', 'playing', 'paused'].includes(frame.playback));
  if (s.previousInteraction && !interacted) s.interactionProtection = sampleRange(random, c.interactionProtectionSeconds);
  if (s.previousPlayback && !playback) s.waitingForScene = true;
  if (s.waitingForScene && frame.sceneRestored) {
    s.waitingForScene = false;
    s.playbackProtection = sampleRange(random, c.playbackProtectionSeconds);
  }
  s.previousInteraction = interacted; s.previousPlayback = playback;
  const scenePaused = !frame.available || !frame.healthy || !frame.sceneReady || frame.scenePresence <= 0 || frame.otherPlaybackActive;
  const absoluteHold = playback || s.waitingForScene || scenePaused || frame.reducedMotion;
  const protection = s.playbackProtection > 0;
  const deltaMotion = absoluteHold || protection ? 0 : rampDelta(s, delta, interacted ? 0 : 1, c, random);
  // 播放和场景隐藏即时冻结；交互则按五阶曲线减速，不突然刹车。
  if (absoluteHold || protection) { s.gain = 0; s.ramp = { from: 0, to: 0, elapsed: 0, duration: 1 }; }
  const presenceHeld = interacted || playback || s.waitingForScene || protection || s.interactionProtection > 0;
  if (!scenePaused && !playback && !s.waitingForScene) {
    s.playbackProtection = Math.max(0, s.playbackProtection - delta);
    s.interactionProtection = Math.max(0, s.interactionProtection - delta);
  }
  return { playbackHeld: playback, deltaMotion, presenceHeld, scenePaused };
}
