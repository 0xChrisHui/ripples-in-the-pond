import type { FeaturedEcho } from '@/src/types/featured-echo';
import type { GlPhysNode } from '../spheres/gl-sim-setup';
import { unproject, type ProjCtx } from '../sphere-projection';
import { sampleTrack36Path } from './track36-path';

export const TRACK36_TRAVEL_MS = 15_000;
export const TRACK36_RADIUS = 34;

/** 不进入 d3、不属于 Track 集合；只携带 ECHO 永久身份和视觉渲染字段。 */
export interface FeaturedEchoVisualNode {
  kind: 'featured-echo';
  id: string;
  identity: FeaturedEcho['identity'];
  radius: number;
  color: string;
  baseLayer: number;
  kSize: number;
  lw: { amp: number; f1: number; f2: number; p1: number; p2: number };
  x: number;
  y: number;
  z: number;
  displayZ: number;
  _shiftOff?: number;
  _parGain?: number;
  _parAng?: number;
  _waveZ?: number;
  _shivX?: number;
  _shivY?: number;
  _visualDim?: number;
}

export type PondRenderNode = GlPhysNode | FeaturedEchoVisualNode;

export interface Track36VisitorState {
  node: FeaturedEchoVisualNode;
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

/** ECHO 访客从创建起就与普通 Track 节点分型，避免伪造 week/audio_url。 */
export function createTrack36State(echo: FeaturedEcho, initialDelayMs: number): Track36VisitorState {
  const pose = sampleTrack36Path(0);
  return {
    node: {
      kind: 'featured-echo', id: echo.playbackId, identity: echo.identity,
      radius: TRACK36_RADIUS,
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
): PondRenderNode[] {
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
  if (input.hidden) return;
  // 若用户在 WebGL 尚未就绪时从 CSS 圆开始播放，GL 恢复后也要立即建立真实焦点。
  if (input.featuredPlaying) {
    if (!state.active) {
      state.active = true;
      state.progress = 0.5;
      state.lastTrailProgress = -1;
    }
    place(state, input.waterLevel);
    return;
  }
  if (input.anyPlaying || input.now < state.frozenUntil) return;
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
