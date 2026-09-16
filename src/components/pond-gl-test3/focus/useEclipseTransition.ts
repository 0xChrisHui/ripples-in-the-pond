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

function syncCss(value: number, active: boolean): void {
  document.body.style.setProperty('--pond-eclipse-mix', value.toFixed(4));
  const root = document.querySelector<HTMLElement>('[data-pond-root]');
  if (root) root.dataset.pondEclipseActive = active ? 'true' : 'false';
}

export function useEclipseTransition(
  glSim: GlSim,
  visitor: RefObject<Track36VisitorState | null>,
  playingId: string | null,
): void {
  const playerRef = useRef(playingId);
  useEffect(() => { playerRef.current = playingId; }, [playingId]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const trackId = playerRef.current;
      const node = trackId
        ? getPondRenderNodes(glSim.nodes, visitor.current).find(
          (candidate) => candidate.id === trackId,
        )
        : null;
      if (trackId && node && node.x != null && node.y != null) {
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
          scale: node.radius * pose.scale / 50,
        });
      } else clearPlaybackFocus();
      const isFocused = !!trackId && !!node;
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
  }, [glSim.nodes, visitor]);
}
