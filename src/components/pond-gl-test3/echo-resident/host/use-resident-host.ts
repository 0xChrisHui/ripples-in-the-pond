'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ResidentEchoCommand, ResidentEchoLayout, ResidentHostOptions } from '@/src/types/echo-resident';
import { getPointerFx, getCameraFx } from '../../pointer-fx';
import { getEffectiveWaterLevel } from '../../water/water-level';
import { getEclipseMix } from '../../focus/playback-focus';
import { prefersReducedMotion } from '../../reduced-motion';
import { useResidentEcho } from '../use-resident-echo';
import { isResidentEchoAvailable, resolveResidentHostFrame } from './frame-input';

function initialLayout(): ResidentEchoLayout {
  return { width: 1, height: 1, controls: [], safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    baseRadiusPx: 34, maxProjectionScale: 1.5, haloRatio: 1.16, surface: 0.525,
    projection: { cx: 0.5, cy: 0.5, mx: 0, my: 0, focusZ: 0.525, dof: false, perspective: false, parallax: false } };
}
/** 保留主线已验证资产和唯一播放器；只管理布局与驻留视觉，不再fetch/建音频引擎。 */
export function useResidentHost(options: ResidentHostOptions) {
  const latest = useRef(options), layout = useRef(initialLayout());
  const runtime = useResidentEcho({ layout: initialLayout(), seed: options.seed });
  useEffect(() => { latest.current = options; }, [options]);
  useEffect(() => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    probe.setAttribute('aria-hidden', 'true'); document.body.append(probe);
    const watched = new Set<Element>();
    const measure = () => {
      const nodes = new Set(document.querySelectorAll('[data-pond-ui="true"],header,nav,.bottom-player-shell'));
      for (const node of watched) if (!nodes.has(node)) { observer.unobserve(node); watched.delete(node); }
      for (const node of nodes) if (!watched.has(node)) { observer.observe(node); watched.add(node); }
      const safe = getComputedStyle(probe);
      layout.current = { ...layout.current, width: innerWidth, height: innerHeight,
        safeArea: { top: parseFloat(safe.paddingTop) || 0, right: parseFloat(safe.paddingRight) || 0,
          bottom: parseFloat(safe.paddingBottom) || 0, left: parseFloat(safe.paddingLeft) || 0 },
        controls: [...nodes].filter((el) => {
          const style = getComputedStyle(el);
          return style.visibility !== 'hidden' && style.display !== 'none' && !el.closest('[aria-hidden="true"],[inert]');
        }).map((el) => {
          const rect = el.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }).filter((rect) => rect.width > 0 && rect.height > 0) };
    };
    const observer = new ResizeObserver(measure), changes = new MutationObserver(measure);
    changes.observe(document.body, { childList: true, subtree: true });
    observer.observe(document.body); window.addEventListener('resize', measure); measure();
    return () => {
      changes.disconnect(); observer.disconnect(); watched.clear();
      window.removeEventListener('resize', measure); probe.remove();
    };
  }, []);
  const getFrameInput = useCallback(() => {
    const current = latest.current, surface = getEffectiveWaterLevel();
    const size = current.glSim.sizeRef.current, pointer = getPointerFx(), camera = getCameraFx();
    return resolveResidentHostFrame({
      layout: { ...layout.current, surface, projection: {
        cx: (size.w || layout.current.width) / 2, cy: (size.h || layout.current.height) / 2,
        mx: pointer.mx, my: pointer.my, focusZ: surface, ...camera } },
      echoAvailable: isResidentEchoAvailable(current.echo, Number(process.env.NEXT_PUBLIC_CHAIN_ID)),
      healthy: current.health === 'healthy', sceneReady: current.ready, homeActive: current.homeActive,
      routePresence: current.scenePresence.current, eclipseMix: getEclipseMix(),
      playback: current.playback.state, otherPlaybackActive: current.otherPlaybackActive,
      reducedMotion: prefersReducedMotion(),
    });
  }, []);
  const execute = useCallback(async (command: ResidentEchoCommand) => {
    const playback = latest.current.playback;
    if (command === 'stop') playback.stop();
    else if (command === 'pause') playback.pause();
    else if (command === 'resume') await playback.resume();
    else if (command === 'retry') await playback.retry();
    else if (playback.state !== 'loading') await playback.toggle();
  }, []);
  const getPlayback = useCallback(() => latest.current.playback.state, []);
  useEffect(() => {
    if (runtime && (!options.echo || options.health !== 'healthy' || !options.ready || !options.homeActive)) {
      runtime.step(getFrameInput());
    }
  }, [runtime, options.echo, options.health, options.ready, options.homeActive, getFrameInput]);
  return { runtime, getFrameInput, getPlayback, execute };
}
