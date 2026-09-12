import type { Track } from '@/src/types/tracks';
import type { GlPhysNode } from '../spheres/gl-sim-setup';
import { unproject, type ProjCtx } from '../sphere-projection';
import { sampleTrack36Path } from './track36-path';

export const TRACK36_TRAVEL_MS = 15_000;
export const TRACK36_RADIUS = 34;

export interface Track36VisitorState {
  node: GlPhysNode;
  active: boolean;
  progress: number;
  waitMs: number;
  lastAt: number;
  frozenUntil: number;
  lastTrailProgress: number;
  lastDepthOffset: number;
  interactionSlow: boolean;
  screenX: number;
  screenY: number;
}

export interface Track36Advance {
  now: number;
  width: number;
  height: number;
  anyPlaying: boolean;
  featuredPlaying: boolean;
  hidden: boolean;
  reducedMotion: boolean;
  nextDelayMs: number;
  waterLevel: number;
}

export function createTrack36State(track: Track, initialDelayMs: number): Track36VisitorState {
  const pose = sampleTrack36Path(0);
  return {
    node: {
      id: track.id, track, groupId: 'A', importance: 1, radius: TRACK36_RADIUS,
      color: '#d9e6df', baseLayer: 8, kSize: TRACK36_RADIUS,
      lw: { amp: 0.72, f1: 0.07, f2: 0.17, p1: 0, p2: 2.4 },
      x: 0, y: 0, z: 0, displayZ: 0,
    },
    active: false, progress: 0, waitMs: initialDelayMs, lastAt: 0,
    frozenUntil: 0, lastTrailProgress: -1, lastDepthOffset: pose.depthOffset,
    interactionSlow: false,
    screenX: pose.x, screenY: pose.y,
  };
}

export function getPondRenderNodes(
  regular: GlPhysNode[],
  visitor: Track36VisitorState | null,
): GlPhysNode[] {
  return visitor?.active ? [...regular, visitor.node] : regular;
}

export function freezeTrack36Visitor(state: Track36VisitorState): void {
  state.frozenUntil = performance.now() + 500;
}

export function setTrack36VisualDim(state: Track36VisitorState, value: number): void {
  state.node._visualDim = value;
}

export function setTrack36InteractionSlow(state: Track36VisitorState, value: boolean): void {
  state.interactionSlow = value;
}

function place(state: Track36VisitorState, waterLevel: number): void {
  const pose = sampleTrack36Path(state.progress);
  state.screenX = pose.x; state.screenY = pose.y;
  const depth = Math.max(0, Math.min(1, waterLevel + pose.depthOffset));
  state.node.z = depth; state.node.displayZ = depth;
}

/** 目标是屏幕路径，先逆投影进 sim；渲染时同一 project() 会精确回到目标像素。 */
export function positionTrack36InSim(
  state: Track36VisitorState, width: number, height: number, ctx: ProjCtx,
): void {
  const point = unproject(state.screenX * width, state.screenY * height, state.node.z, ctx, state.node);
  state.node.x = point.x; state.node.y = point.y;
}

/** 命令式推进可被 rAF 与测试共用；后台、播放态都只更新时间基线，不累计跳帧。 */
export function advanceTrack36Visitor(state: Track36VisitorState, input: Track36Advance): void {
  const dt = state.lastAt ? Math.min(250, Math.max(0, input.now - state.lastAt)) : 0;
  state.lastAt = input.now;
  if (input.reducedMotion) {
    state.active = true;
    state.progress = 0.5;
    state.screenX = 0.72; state.screenY = 0.3;
    state.node.z = input.waterLevel; state.node.displayZ = input.waterLevel;
    return;
  }
  if (input.hidden || input.anyPlaying || input.now < state.frozenUntil) return;
  if (!state.active) {
    state.waitMs -= dt;
    if (state.waitMs > 0) return;
    state.active = true;
    state.progress = 0;
    state.lastTrailProgress = -1;
  } else if (!input.featuredPlaying) {
    state.progress += (dt / TRACK36_TRAVEL_MS) * (state.interactionSlow ? 0.15 : 1);
    if (state.progress >= 1) {
      state.active = false;
      state.progress = 0;
      state.waitMs = input.nextDelayMs;
      return;
    }
  }
  place(state, input.waterLevel);
}
