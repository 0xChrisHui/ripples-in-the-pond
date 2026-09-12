'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { Track } from '@/src/types/tracks';
import { getPointerFx, getCameraFx, depthOf } from '../pointer-fx';
import { project, type ProjCtx } from '../sphere-projection';
import { getEffectiveWaterLevel } from '../water/water-level';
import { getScenePresence } from '../focus/playback-focus';
import {
  freezeTrack36Visitor, setTrack36InteractionSlow, type Track36VisitorState,
} from './track36-state';

interface Props {
  track: Track;
  visitor: RefObject<Track36VisitorState | null>;
  playing: boolean;
  toggle: (track: Track) => Promise<void>;
}

export default function Track36HitTarget({ track, visitor, playing, toggle }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const state = visitor.current, button = buttonRef.current;
      if (button) {
        const visible = !!state?.active;
        const presence = getScenePresence();
        const interactive = visible && (presence > 0.1 || playing);
        button.style.pointerEvents = interactive ? 'auto' : 'none';
        button.tabIndex = interactive ? 0 : -1;
        button.style.opacity = visible ? String(presence) : '0';
        if (state) {
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
  }, [playing, visitor]);

  return (
    <button ref={buttonRef} type="button"
      aria-label={`${playing ? '暂停' : '播放'} 第 36 首：${track.title}`}
      aria-pressed={playing} data-track36-hit="true"
      onPointerEnter={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, true); }}
      onPointerLeave={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, false); }}
      onFocus={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, true); }}
      onBlur={() => { if (visitor.current) setTrack36InteractionSlow(visitor.current, false); }}
      onClick={(event) => {
        const state = visitor.current;
        if (state) freezeTrack36Visitor(state);
        void toggle(track);
        if (event.detail > 0) event.currentTarget.blur();
      }}
      className="group pointer-events-none absolute left-0 top-0 min-h-11 min-w-11 rounded-full border-0 bg-transparent p-0 opacity-0 outline-none focus-visible:ring-1 focus-visible:ring-white/80"
      style={{ cursor: 'pointer', touchAction: 'manipulation', willChange: 'transform' }}>
      <span className="absolute left-[72%] top-[72%] -translate-x-1/2 -translate-y-1/2 font-serif text-[13px] font-light tracking-[0.18em] text-white/60" aria-hidden="true">36</span>
      <span className="pointer-events-none absolute left-[72%] top-[92%] -translate-x-1/2 whitespace-nowrap font-serif text-[10px] font-light tracking-[0.08em] text-white/0 transition-colors group-hover:text-white/55 group-focus-visible:text-white/55" aria-hidden="true">
        {track.title}
      </span>
    </button>
  );
}
