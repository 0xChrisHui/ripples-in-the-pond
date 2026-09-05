'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { endNodeDrag, setNodeDrag, type GlPhysNode } from '../spheres/gl-sim-setup';
import type { GlSim } from '../spheres/use-gl-sim';
import { getPointerFx, getCameraFx, depthOf } from '../pointer-fx';
import { getEffectiveWaterLevel } from '../water/water-level';
import { unproject, type ProjCtx } from '../sphere-projection';

const PLAY_PATH = 'M-4.5,-6 L7,0 L-4.5,6 Z';
const PAUSE_PATH = 'M-5.5,-6 L-2,-6 L-2,6 L-5.5,6 Z M0.5,-6 L4,-6 L4,6 L0.5,6 Z';
const DRAG_THRESHOLD = 8;

export function currentSphereContext(): ProjCtx {
  const { mx, my } = getPointerFx();
  const camera = getCameraFx();
  return {
    cx: window.innerWidth / 2, cy: window.innerHeight / 2, mx, my,
    focusZ: getEffectiveWaterLevel(), dof: camera.dof,
    perspective: camera.perspective, parallax: camera.parallax,
  };
}

type Props = {
  node: GlPhysNode;
  glSim: GlSim;
  isPlaying: boolean;
  showLabels: boolean;
  glHealthy: boolean;
  register: (element: HTMLButtonElement | null) => void;
};

/** 同一个命中节点承载 GL 与轻量兜底，接管时不会重挂按钮或更换音乐身份。 */
export default function SphereHit({ node, glSim, isPlaying, showLabels, glHealthy, register }: Props) {
  const [hovered, setHovered] = useState(false);
  const drag = useRef({ down: false, moved: false, x: 0, y: 0 });
  const radius = node.radius;
  const show = hovered || isPlaying;
  const titleSize = radius * ((node.track.title?.length ?? 1) >= 2 ? 1 : 1.26);
  const togglePlayback = useCallback(() => { void glSim.toggle(node.track); }, [glSim, node.track]);
  const finishDrag = useCallback(() => {
    const state = drag.current;
    if (!state.down && !state.moved) return;
    endNodeDrag(node);
    glSim.simRef.current?.alphaTarget(0.008);
    drag.current = { down: false, moved: false, x: 0, y: 0 };
  }, [glSim.simRef, node]);

  useEffect(() => () => finishDrag(), [finishDrag]);

  const onDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { down: true, moved: false, x: event.clientX, y: event.clientY };
  };
  const onMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state.down) return;
    if (!state.moved) {
      if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < DRAG_THRESHOLD) return;
      state.moved = true;
      glSim.simRef.current?.alphaTarget(0.08).restart();
    }
    const point = unproject(event.clientX, event.clientY, depthOf(node), currentSphereContext(), node);
    setNodeDrag(node, point.x, point.y);
  };
  const onUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.down) return;
    const shouldToggle = !drag.current.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
    if (shouldToggle) { togglePlayback(); event.currentTarget.blur(); }
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    togglePlayback();
  };

  return (
    <button type="button" ref={register} data-track-id={node.track.id} data-render-node-id={node.id}
      aria-label={`${isPlaying ? '暂停' : '播放'} ${node.track.title}`} aria-pressed={isPlaying}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onKeyDown={onKeyDown}
      onPointerEnter={() => { setHovered(true); glSim.setHover(node.id); }}
      onPointerLeave={() => { setHovered(false); glSim.setHover(null); }}
      style={{ position: 'absolute', width: radius * 2, height: radius * 2, padding: 0,
        border: 0, outline: 'none', background: 'transparent', cursor: 'pointer',
        willChange: 'transform', transition: 'opacity 0.4s ease', touchAction: 'none' }}>
      {!glHealthy && <span aria-hidden="true" style={{ position: 'absolute', inset: 0,
        borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, white 0, ${node.color} 18%, #05080a 72%)`,
        boxShadow: `0 0 ${Math.max(18, radius)}px color-mix(in srgb, ${node.color} 52%, transparent)`,
        opacity: 0.82 }} />}
      {showLabels && <span style={{ position: 'absolute', left: radius * 1.55, top: radius * 1.55,
        transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-modak), sans-serif',
        fontSize: titleSize, fontWeight: 400, color: '#fff', opacity: hovered ? 0.55 : 0.32,
        pointerEvents: 'none', whiteSpace: 'nowrap', transition: 'opacity 0.25s ease' }}>
        {node.track.title}
      </span>}
      <svg width={26} height={26} viewBox="-13 -13 26 26" style={{ position: 'absolute',
        left: radius - 13, top: radius - 13, opacity: show ? 1 : 0,
        pointerEvents: 'none', transition: 'opacity 0.2s ease' }}>
        <circle r={13} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
        <path d={isPlaying ? PAUSE_PATH : PLAY_PATH} fill="white" />
      </svg>
    </button>
  );
}
