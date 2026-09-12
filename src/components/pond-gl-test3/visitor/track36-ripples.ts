import type { Drop } from '../water/ripple-feed';
import type { Track36VisitorState } from './track36-state';
import { sampleTrack36Path } from './track36-path';

const MAX_PENDING = 8;
const pending: Drop[] = [];

/** 连续尾迹只进入 FBO drop 队列；返回 true 表示本次恰好穿越水面。 */
export function queueTrack36Ripple(state: Track36VisitorState): boolean {
  const offset = sampleTrack36Path(state.progress).depthOffset;
  const crossed = (state.lastDepthOffset < 0) !== (offset < 0);
  state.lastDepthOffset = offset;
  if (!crossed && offset >= 0) return false;
  if (state.screenX >= 0 && state.screenX <= 1 && state.screenY >= 0 && state.screenY <= 1) {
    if (pending.length >= MAX_PENDING) pending.shift();
    pending.push({
      ux: state.screenX, uy: 1 - state.screenY,
      radius: crossed ? 0.028 : 0.014,
      strength: crossed ? 0.72 : 0.18,
    });
  }
  return crossed;
}

export function drainTrack36Drops(): Drop[] {
  return pending.splice(0, MAX_PENDING);
}

export function resetTrack36Drops(): void {
  pending.length = 0;
}
