'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { GlSim } from '../spheres/use-gl-sim';
import { getPondRenderNodes, type Track36VisitorState } from '../visitor/track36-state';
import { project, applyFloat, type ProjCtx } from '../sphere-projection';
import { getPointerFx, getCameraFx, depthOf } from '../pointer-fx';
import { getEffectiveWaterLevel } from '../water/water-level';
import { prefersReducedMotion } from '../reduced-motion';
import {
  advanceEclipseMix, clearPlaybackFocus, resetEclipseMix, setPlaybackFocus,
} from './playback-focus';
import type { ResidentEchoRuntime } from '@/src/types/echo-resident';
import { isResidentPlaybackFocus } from '../echo-resident/host/frame-input';
import { advanceCircleHover } from '../eclipse-base/eclipse-motion';

function syncCss(value: number, active: boolean): void {
  document.body.style.setProperty('--pond-eclipse-mix', value.toFixed(4));
  const root = document.querySelector<HTMLElement>('[data-pond-root]');
  if (root) root.dataset.pondEclipseActive = active ? 'true' : 'false';
}

export function useEclipseTransition(
  glSim: GlSim,
  visitor: RefObject<Track36VisitorState | null>,
  playingId: string | null,
  resident?: { runtime: ResidentEchoRuntime; playbackId: string },
  enabled = true,
): void {
  const playerRef = useRef(playingId);
  useEffect(() => { playerRef.current = playingId; }, [playingId]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0, last = performance.now(), hover = 0;
    const loop = (now: number) => {
      const trackId = playerRef.current;
      const residentPose = trackId && trackId === resident?.playbackId
        ? resident.runtime.getSnapshot().pose : null;
      const residentFocused = isResidentPlaybackFocus(trackId, resident?.playbackId, residentPose);
      const node = trackId && !residentPose
        ? getPondRenderNodes(glSim.nodes, visitor.current).find(
          (candidate) => candidate.id === trackId,
        )
        : null;
      if (trackId && residentPose && residentFocused) {
        const interaction = resident?.runtime.getSnapshot().interaction;
        setPlaybackFocus({ active: true, trackId, x: residentPose.sx / innerWidth,
          y: residentPose.sy / innerHeight, scale: residentPose.bodyRadiusPx / 50,
          hovered: Boolean(interaction?.hovered || interaction?.focused) });
      } else if (trackId && node && node.x != null && node.y != null) {
        const hovered = glSim.hoverIdRef.current === trackId;
        hover = advanceCircleHover(hover, hovered, now - last, prefersReducedMotion());
        const { mx, my } = getPointerFx(); const camera = getCameraFx();
        const ctx: ProjCtx = {
          cx: innerWidth / 2, cy: innerHeight / 2, mx, my,
          focusZ: getEffectiveWaterLevel(), dof: camera.dof,
          perspective: camera.perspective, parallax: camera.parallax,
        };
        const pose = applyFloat(project(node.x, node.y, depthOf(node), ctx, node), node, ctx.cx, ctx.cy);
        setPlaybackFocus({
          active: true, trackId,
          x: pose.sx / innerWidth, y: pose.sy / innerHeight,
          scale: node.radius * pose.scale * (1 + hover * .09) / 50, hovered,
        });
      } else clearPlaybackFocus();
      const isFocused = !!trackId && (!!node || residentFocused);
      const mix = advanceEclipseMix(isFocused ? 1 : 0, now - last, prefersReducedMotion());
      syncCss(mix, isFocused);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); clearPlaybackFocus(); resetEclipseMix(); syncCss(0, false);
      document.body.style.removeProperty('--pond-eclipse-mix');
    };
  }, [enabled, glSim.nodes, glSim.hoverIdRef, resident?.playbackId, resident?.runtime, visitor]);
}
