'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import type { GlSim } from '../spheres/use-gl-sim';
import { setNodeDrag, endNodeDrag, type GlPhysNode } from '../spheres/gl-sim-setup';
import { getSubmerge } from '../water/water-level';

/**
 * G4 — DOM 命中层：每球一个绝对定位 div，承载标题/角标/点击播放/拖拽/hover。
 *
 * 命中热区跟 sim 坐标走（不受未来水下折射的视觉偏移影响）。每帧只写 transform。
 * 点击走 PlayerProvider.toggle；拖拽 8px 阈值区分 click，pointermove 写 node.fx/fy。
 */

const PLAY_PATH = 'M-4.5,-6 L7,0 L-4.5,6 Z';
const PAUSE_PATH = 'M-5.5,-6 L-2,-6 L-2,6 L-5.5,6 Z M0.5,-6 L4,-6 L4,6 L0.5,6 Z';
const DRAG_THRESHOLD = 8; // 出处 sphere-sim-setup.ts:178（位移 <8px 不算拖动，松手仍 toggle）

export default function SphereOverlay({ glSim, waterOn }: { glSim: GlSim; waterOn: boolean }) {
  const { nodes, playingIdRef } = glSim;
  const { playing, currentTrack } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;
  const elsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // 每帧把每个 hit-div 移到对应球的 sim 坐标（div 左上角对齐 (x-r, y-r) → 中心落在球心）
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const pid = playingIdRef.current;
      for (const n of nodes) {
        const el = elsRef.current.get(n.id);
        if (!el || n.x == null || n.y == null) continue;
        const dim = pid != null && n.id !== pid;
        // G6 没入：球被水波盖住时同步淡出标题/命中（否则标题会浮在水面上）；>0.7 视为已没入、不可点
        // H5：读动态深度 displayZ → 球浮沉/播放浮出时标题随之淡入淡出
        const sub = waterOn ? getSubmerge(n.displayZ ?? n.z) : 0;
        el.style.transform = `translate(${n.x - n.radius}px, ${n.y - n.radius}px)`;
        el.style.opacity = dim ? '0' : String(1 - sub);
        el.style.pointerEvents = dim || sub > 0.7 ? 'none' : 'auto';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [nodes, playingIdRef, waterOn]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {nodes.map((n) => (
        <SphereHit
          key={n.id}
          node={n}
          glSim={glSim}
          isPlaying={playingId === n.id}
          register={(el) => {
            if (el) elsRef.current.set(n.id, el);
            else elsRef.current.delete(n.id);
          }}
        />
      ))}
    </div>
  );
}

interface HitProps {
  node: GlPhysNode;
  glSim: GlSim;
  isPlaying: boolean;
  register: (el: HTMLDivElement | null) => void;
}

function SphereHit({ node, glSim, isPlaying, register }: HitProps) {
  const [hovered, setHovered] = useState(false);
  const drag = useRef({ down: false, moved: false, x: 0, y: 0 });
  const r = node.radius;
  const show = hovered || isPlaying;
  const titleSize = r * ((node.track.title?.length ?? 1) >= 2 ? 1.0 : 1.26);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { down: true, moved: false, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.down) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return; // 微位移不算拖
      d.moved = true;
      glSim.simRef.current?.alphaTarget(0.08).restart(); // 拖动期间升温 sim 跟手
    }
    // sim 坐标 = 视口坐标（正交相机像素 1:1 + overlay 全屏）；mutate 走模块级 helper
    setNodeDrag(node, e.clientX, e.clientY);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.moved) {
      endNodeDrag(node);
      glSim.simRef.current?.alphaTarget(0.008);
    } else {
      void glSim.toggle(node.track); // 没拖动 = 点击播放
    }
    drag.current.down = false;
  };

  return (
    <div
      ref={register}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerEnter={() => { setHovered(true); glSim.setHover(node.id); }}
      onPointerLeave={() => { setHovered(false); glSim.setHover(null); }}
      style={{
        position: 'absolute',
        width: r * 2,
        height: r * 2,
        cursor: 'pointer',
        willChange: 'transform',
        transition: 'opacity 0.4s ease',
        touchAction: 'none',
      }}
    >
      {/* 标题：Modak 气球字，偏球心右下（复刻 SphereNode 的 0.55r 偏移） */}
      <span
        style={{
          position: 'absolute',
          left: r * 1.55,
          top: r * 1.55,
          transform: 'translate(-50%, -50%)',
          fontFamily: 'var(--font-modak), sans-serif',
          fontSize: titleSize,
          fontWeight: 400,
          color: '#ffffff',
          opacity: hovered ? 0.55 : 0.32,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          transition: 'opacity 0.25s ease',
        }}
      >
        {node.track.title}
      </span>

      {/* 角标圆 + play/pause（hover 或播放时显示） */}
      <svg
        width={26}
        height={26}
        viewBox="-13 -13 26 26"
        style={{
          position: 'absolute',
          left: r - 13,
          top: r - 13,
          opacity: show ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease',
        }}
      >
        <circle r={13} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
        <path d={isPlaying ? PAUSE_PATH : PLAY_PATH} fill="white" />
      </svg>
    </div>
  );
}
