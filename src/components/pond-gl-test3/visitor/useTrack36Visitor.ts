'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { FeaturedEcho } from '@/src/types/featured-echo';
import { prefersReducedMotion } from '../reduced-motion';
import { getPointerFx, getCameraFx } from '../pointer-fx';
import { getEffectiveWaterLevel } from '../water/water-level';
import type { ProjCtx } from '../sphere-projection';
import {
  advanceTrack36Visitor, createTrack36State, positionTrack36InSim, type Track36VisitorState,
} from './track36-state';
import { queueTrack36Ripple, resetTrack36Drops } from './track36-ripples';

const firstDelay = (): number => 2_000 + Math.random() * 2_000;
const repeatDelay = (): number => 24_000 + Math.random() * 12_000;
const TRAIL_STEP = 0.035;

function emitRipple(state: Track36VisitorState): void {
  if (!state.active || state.progress - state.lastTrailProgress < TRAIL_STEP) return;
  state.lastTrailProgress = state.progress;
  if (!queueTrack36Ripple(state)) return;
  window.dispatchEvent(new CustomEvent('bg-ripple:wave', { detail: {
    x: state.screenX * innerWidth, y: state.screenY * innerHeight,
    size: 520, duration: 5.2, strength: 0,
  } }));
}

/** 只管理已经由公开 API 验证过的 ECHO #1；缺失时不构造访客。 */
export function useTrack36Visitor(
  echo: FeaturedEcho | null,
  active: boolean,
  activePlaybackId: string | null,
): RefObject<Track36VisitorState | null> {
  const stateRef = useRef<Track36VisitorState | null>(null);
  const playerRef = useRef(activePlaybackId);
  useEffect(() => { playerRef.current = activePlaybackId; }, [activePlaybackId]);

  useEffect(() => {
    if (!echo || !active) { stateRef.current = null; return; }
    const state = createTrack36State(echo, firstDelay());
    resetTrack36Drops();
    stateRef.current = state;
    let raf = 0;
    const loop = (now: number) => {
      const pid = playerRef.current;
      const waterLevel = getEffectiveWaterLevel();
      advanceTrack36Visitor(state, {
        now, width: innerWidth, height: innerHeight,
        anyPlaying: pid !== null, featuredPlaying: pid === echo.playbackId,
        hidden: document.hidden, reducedMotion: prefersReducedMotion(),
        nextDelayMs: repeatDelay(), waterLevel,
      });
      const pointer = getPointerFx(); const camera = getCameraFx();
      const ctx: ProjCtx = {
        cx: innerWidth / 2, cy: innerHeight / 2, mx: pointer.mx, my: pointer.my,
        focusZ: waterLevel, dof: camera.dof,
        perspective: camera.perspective, parallax: camera.parallax,
      };
      positionTrack36InSim(state, innerWidth, innerHeight, ctx);
      if (!prefersReducedMotion() && pid === null) emitRipple(state);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); resetTrack36Drops(); stateRef.current = null; };
  }, [active, echo]);

  return stateRef;
}
