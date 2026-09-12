'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { Track } from '@/src/types/tracks';
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

/** 只管理一位访客；Track 缺失时保持 null，不构造本地假音频。 */
export function useTrack36Visitor(
  track: Track | null,
  active: boolean,
  playingTrackId: string | null,
): RefObject<Track36VisitorState | null> {
  const stateRef = useRef<Track36VisitorState | null>(null);
  const playerRef = useRef(playingTrackId);
  useEffect(() => { playerRef.current = playingTrackId; }, [playingTrackId]);

  useEffect(() => {
    if (!track || !active) { stateRef.current = null; return; }
    const state = createTrack36State(track, firstDelay());
    resetTrack36Drops();
    stateRef.current = state;
    let raf = 0;
    const loop = (now: number) => {
      const pid = playerRef.current;
      const waterLevel = getEffectiveWaterLevel();
      advanceTrack36Visitor(state, {
        now, width: innerWidth, height: innerHeight,
        anyPlaying: pid !== null, featuredPlaying: pid === track.id,
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
  }, [active, track]);

  return stateRef;
}
