import type { ProjCtx } from '../../components/pond-gl-test3/sphere-projection';
import type { RefObject } from 'react';
import type { FeaturedEcho } from '../featured-echo';
import type { FeaturedEchoPlayback } from '../../components/pond-gl-test3/visitor/useFeaturedEchoPlayback';
import type { GlHealth } from '../../components/pond-gl-test3/PondGL';
import type { GlSim } from '../../components/pond-gl-test3/spheres/use-gl-sim';

export type ResidentRange = readonly [number, number];
export type ResidentRect = { x: number; y: number; width: number; height: number };
export type ResidentPoint = { x: number; y: number };
export type ResidentEchoConfig = {
  residentConfigVersion: 1;
  diameterMultiplier: number;
  breathScale: ResidentRange; breathCycleSeconds: ResidentRange;
  driftFraction: ResidentRange; driftSeconds: ResidentRange;
  maxDriftPx: number; maxSpeedPxPerSecond: number; maxCandidates: number;
  depthAboveSurface: ResidentRange; depthBelowSurface: ResidentRange;
  depthCycleSeconds: ResidentRange;
  visibleSeconds: ResidentRange; hiddenSeconds: ResidentRange;
  fadeInSeconds: ResidentRange; fadeOutSeconds: ResidentRange;
  firstDelaySeconds: ResidentRange; interactionProtectionSeconds: ResidentRange;
  playbackProtectionSeconds: ResidentRange; resumeSeconds: ResidentRange;
  edgeMarginPx: number; controlMarginPx: number; focusRingPx: number;
  maxDeltaSeconds: number; hitThreshold: number;
};
export type ResidentEchoLayout = {
  width: number; height: number; controls: readonly ResidentRect[];
  safeArea: { top: number; right: number; bottom: number; left: number };
  baseRadiusPx: number; maxProjectionScale: number; haloRatio: number;
  surface: number; projection: ProjCtx;
};
export type ResidentEchoBounds = {
  rect: ResidentRect; envelopeRadiusPx: number;
  sizeScale: number; sizeClamped: boolean;
};
export type ResidentEchoPhase = 'waiting' | 'fading_in' | 'visible' | 'fading_out' | 'hidden';
export type ResidentEchoPlayback = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
export type ResidentEchoInteraction = { hovered: boolean; focused: boolean; pointerDown: boolean };
// 身份校验与永久内容解析归服务端；控制器只消费宿主已验证的 available。
export type ResidentEchoAsset =
  | { status: 'available'; chainId: 10; contractAddress: string; tokenId: '1'; metadataUri: string }
  | { status: 'unavailable' | 'error'; reason: string };
export type ResidentEchoFrameInput = {
  layout: ResidentEchoLayout; available: boolean; healthy: boolean; sceneReady: boolean;
  scenePresence: number; sceneRestored: boolean; reducedMotion: boolean;
  playback: ResidentEchoPlayback; otherPlaybackActive: boolean;
};
export type ResidentEchoPose = {
  instanceId: string; frameId: number; sx: number; sy: number;
  depth: number; breathScale: number; bodyRadiusPx: number; haloRadiusPx: number;
  presence: number; effectivePresence: number; interactive: boolean; tabbable: boolean;
  sizeClamped: boolean; sizeScale: number; resizeConstrained: boolean;
};
export type ResidentEchoSnapshot = {
  pose: ResidentEchoPose; phase: ResidentEchoPhase;
  motionSeconds: number; presenceSeconds: number; playbackHeld: boolean;
  commandPending: boolean; commandError: string | null; destroyed: boolean;
  randomCalls: { drift: number; depth: number; scale: number; presence: number };
};
export type ResidentEchoCommand = 'play' | 'pause' | 'resume' | 'retry' | 'stop';
export type ResidentEchoRuntime = {
  step: (input: ResidentEchoFrameInput, nowMs?: number) => ResidentEchoSnapshot;
  getSnapshot: () => ResidentEchoSnapshot;
  subscribe: (listener: () => void) => () => void;
  setInteraction: (interaction: Partial<ResidentEchoInteraction>) => void;
  setVisibility: (hidden: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  request: (command: ResidentEchoCommand, execute: (command: ResidentEchoCommand) => void | Promise<void>) => Promise<void>;
  destroy: () => void;
};
export type ResidentEchoOptions = {
  layout: ResidentEchoLayout; seed?: number; clock?: () => number; config?: unknown;
  onConfigError?: (reasons: readonly string[]) => void;
};
export type ResidentRandomStream = { next: () => number; readonly calls: number };
export type ResidentRandom = Record<'drift' | 'depth' | 'scale' | 'presence', ResidentRandomStream>;
export type ResidentScalarSegment = { from: number; to: number; start: number; duration: number };
export type ResidentMotionState = {
  drift: { from: ResidentPoint; to: ResidentPoint; start: number; duration: number };
  depth: ResidentScalarSegment; scale: ResidentScalarSegment;
  depthRising: boolean; scaleRising: boolean; surface: number;
  bounds: ResidentEchoBounds; layoutKey: string; resizeConstrained: boolean;
};
export type ResidentPresenceState = {
  phase: ResidentEchoPhase; elapsed: number; duration: number;
  presence: number; heldPresence: number | null;
};
export type ResidentHostFrameState = {
  layout: ResidentEchoLayout; echoAvailable: boolean; healthy: boolean; sceneReady: boolean;
  homeActive: boolean; routePresence: number; eclipseMix: number;
  playback: ResidentEchoPlayback; otherPlaybackActive: boolean; reducedMotion?: boolean;
};
export type ResidentHostOptions = {
  glSim: GlSim; echo: FeaturedEcho | null; playback: FeaturedEchoPlayback;
  health: GlHealth; ready: boolean; homeActive: boolean; otherPlaybackActive: boolean;
  scenePresence: RefObject<number>; seed?: number;
};
