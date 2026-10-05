import type { CircleMotion } from './circle-motion';

export type CirclePlayback = { trackId: string; eclipse: boolean };
export type CircleFrame = {
  x: number; y: number; radius: number; diameter: number; dx: number; dy: number;
  mix: number; time: number; visible: boolean; width: number; height: number; reduced: boolean;
  color: [number, number, number];
};

/** 只有本曲真实开播才能进入；首次等待和换曲不能继承另一首的日食。 */
export function circlePlayback(previous: CirclePlayback, trackId: string, phase: string, eligible: boolean): CirclePlayback {
  const retained = previous.trackId === trackId && previous.eclipse;
  return { trackId, eclipse: eligible && (phase === 'playing' || (phase === 'preparing' && retained)) };
}

/** 平滑压缩靠近边界的运动，始终在可视页面高度±5%内，不硬碰壁反弹。 */
export function circlePose(width: number, pageHeight: number, time: number, reduced: boolean, motion: CircleMotion) {
  const radius = width * .28 * (reduced ? 1 : 1 + Math.sin(time * .63) * .012);
  const diameter = radius * 2;
  const limit = pageHeight * .05;
  return { radius, diameter,
    dx: reduced ? 0 : limit * Math.tanh(motion.x),
    dy: reduced ? 0 : limit * Math.tanh(motion.y),
  };
}
