'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { FeaturedEcho } from '@/src/types/featured-echo';
import { getPointerFx, getCameraFx, depthOf } from '../pointer-fx';
import { project, type ProjCtx } from '../sphere-projection';
import { getEffectiveWaterLevel } from '../water/water-level';
import { getScenePresence } from '../focus/playback-focus';
import {
  freezeTrack36Visitor, setTrack36InteractionSlow, type Track36VisitorState,
} from './track36-state';
import type { FeaturedEchoPlayback } from './useFeaturedEchoPlayback';

interface Props {
  echo: FeaturedEcho;
  visitor: RefObject<Track36VisitorState | null>;
  playbackState: FeaturedEchoPlayback['state'];
  fallback?: boolean;
  toggle: () => Promise<void>;
}

export default function Track36HitTarget({ echo, visitor, playbackState, fallback = false, toggle }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const action = playbackState === 'playing' ? '暂停'
    : playbackState === 'paused' ? '继续'
      : playbackState === 'loading' ? '取消加载' : '播放';
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const state = visitor.current, button = buttonRef.current;
      if (button) {
        const visible = fallback || !!state?.active;
        const presence = getScenePresence();
        const interactive = visible && (presence > 0.1 || playbackState === 'playing');
        button.style.pointerEvents = interactive ? 'auto' : 'none';
        button.tabIndex = interactive ? 0 : -1;
        if (!interactive && document.activeElement === button) button.blur();
        button.style.opacity = visible ? String(presence) : '0';
        if (fallback) {
          button.style.width = '64px'; button.style.height = '64px';
          button.style.transform = 'translate3d(calc(72vw - 32px),calc(30vh - 32px),0)';
        } else if (state) {
          const { mx, my } = getPointerFx(); const camera = getCameraFx();
          const ctx: ProjCtx = {
            cx: innerWidth / 2, cy: innerHeight / 2, mx, my,
            focusZ: getEffectiveWaterLevel(), dof: camera.dof,
            perspective: camera.perspective, parallax: camera.parallax,
          };
          const pose = project(state.node.x ?? 0, state.node.y ?? 0, depthOf(state.node), ctx, state.node);
          const size = Math.max(44 / Math.max(0.35, pose.scale), state.node.radius * 2);
          button.style.width = `${size}px`; button.style.height = `${size}px`;
          button.style.transform = `translate3d(${pose.sx - size / 2}px,${pose.sy - size / 2}px,0) scale(${pose.scale})`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fallback, playbackState, visitor]);

  return (
    <button ref={buttonRef} type="button"
      aria-label={`${action} 第 36 首 Pond Echo #1：${echo.title}`}
      aria-pressed={playbackState === 'playing'} data-featured-echo-hit="true"
      data-echo-render-mode={fallback ? 'css-fallback' : 'webgl'}
      onPointerEnter={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, true); }}
      onPointerLeave={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, false); }}
      onFocus={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, true); }}
      onBlur={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, false); }}
      onClick={(event) => {
        const state = visitor.current;
        if (state) freezeTrack36Visitor(state);
        void toggle();
        if (event.detail > 0) event.currentTarget.blur();
      }}
      className="group pointer-events-none absolute left-0 top-0 min-h-11 min-w-11 rounded-full p-0 opacity-0 outline-none focus-visible:ring-1 focus-visible:ring-white/80"
      style={{ cursor: 'pointer', touchAction: 'manipulation', willChange: 'transform',
        border: fallback ? '1px solid rgba(220,240,234,0.5)' : 0,
        background: fallback ? 'radial-gradient(circle,rgba(217,230,223,0.2),rgba(8,18,16,0.78))' : 'transparent',
        boxShadow: fallback ? '0 0 28px rgba(190,225,215,0.16)' : 'none' }}>
      <span className="absolute left-[72%] top-[72%] -translate-x-1/2 -translate-y-1/2 font-serif text-[13px] font-light tracking-[0.18em] text-white/60" aria-hidden="true">36</span>
      <span className={`pointer-events-none absolute left-[72%] top-[92%] -translate-x-1/2 whitespace-nowrap font-serif text-[10px] font-light tracking-[0.08em] transition-colors ${fallback ? 'text-white/55' : 'text-white/0 group-hover:text-white/55 group-focus-visible:text-white/55'}`} aria-hidden="true">
        {echo.title}
      </span>
    </button>
  );
}
