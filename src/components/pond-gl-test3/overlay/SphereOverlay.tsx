'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import type { GlSim } from '../spheres/use-gl-sim';
import { setNodeDrag, endNodeDrag, type GlPhysNode } from '../spheres/gl-sim-setup';
import { getSubmerge, getEffectiveWaterLevel } from '../water/water-level';
import { project, unproject, type ProjCtx } from '../sphere-projection';
import { getPointerFx, getCameraFx, renderDepth } from '../pointer-fx';

/**
 * G4 — DOM 命中层：每球一个绝对定位 div，承载标题/角标/点击播放/拖拽/hover。
 *
 * /test3 task 4：命中层每帧用与 GL 实例**同一个 project()** 把 div 移到球的投影位置 + 同款缩放/景深，
 * 故点击热区永远贴着视觉球；拖拽用 unproject() 把光标还原成 sim 坐标 → 缩放/视差下仍跟手。
 * 点击走 PlayerProvider.toggle；拖拽 8px 阈值区分 click，pointermove 写 node.fx/fy。
 */

const PLAY_PATH = 'M-4.5,-6 L7,0 L-4.5,6 Z';
const PAUSE_PATH = 'M-5.5,-6 L-2,-6 L-2,6 L-5.5,6 Z M0.5,-6 L4,-6 L4,6 L0.5,6 Z';
const DRAG_THRESHOLD = 8; // 出处 sphere-sim-setup.ts:178（位移 <8px 不算拖动，松手仍 toggle）

/** 命中层用的投影上下文：灭点=视口中心，缩放/视差读 pointer-fx，对焦面=有效水位（与 GL 实例同口径）。 */
function currentCtx(): ProjCtx {
  const { mx, my } = getPointerFx();
  const c = getCameraFx();
  return { cx: window.innerWidth / 2, cy: window.innerHeight / 2, mx, my, focusZ: getEffectiveWaterLevel(), dof: c.dof, perspective: c.perspective, parallax: c.parallax };
}

export default function SphereOverlay({ glSim, waterOn, depthModel = false }: { glSim: GlSim; waterOn: boolean; depthModel?: boolean }) {
  const { nodes, playingIdRef } = glSim;
  const { playing, currentTrack } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;
  const elsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const subSmooth = useRef<Map<string, number>>(new Map()); // K3 修 R4：没入度逐节点阻尼，消标题闪烁

  // 每帧把每个 hit-div 移到对应球的 sim 坐标（div 左上角对齐 (x-r, y-r) → 中心落在球心）
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const pid = playingIdRef.current;
      const ctx = currentCtx(); // 每帧一次（缩放/视差/对焦面），逐球复用
      for (const n of nodes) {
        const el = elsRef.current.get(n.id);
        if (!el || n.x == null || n.y == null) continue;
        const dim = pid != null && n.id !== pid;
        // G6 没入：球被水波盖住时同步淡出标题/命中（否则标题会浮在水面上）；>0.7 视为已没入、不可点
        // H5：读动态深度 displayZ → 球浮沉/播放浮出时标题随之淡入淡出
        const dz = n.displayZ ?? n.z;
        const raw = waterOn ? getSubmerge(renderDepth(dz, n._waveZ ?? 0)) : 0;
        // K3 修 R4：depthModel 开时对没入度加阻尼（lerp）→ 浮沉小幅脉动不再让标题闪烁
        let sub = raw;
        if (depthModel) {
          sub = (subSmooth.current.get(n.id) ?? raw) * 0.85 + raw * 0.15;
          subSmooth.current.set(n.id, sub);
        }
        // /test3：与 GL 实例同款投影（renderDepth：层模型 + 滚轮集体偏移 + 球浮动层级波动 _waveZ）→ 命中层随球一起变大/小/移
        const p = project(n.x, n.y, renderDepth(n.z, n._waveZ ?? 0), ctx);
        el.style.transform = `translate(${p.sx - n.radius}px, ${p.sy - n.radius}px) scale(${p.scale})`;
        // 失焦球的标题/角标一并虚化（移植 /test 的 CSS blur），与 GL 散景同向
        el.style.filter = p.blurAmt > 0.02 ? `blur(${(p.blurAmt * 3).toFixed(2)}px)` : '';
        // 别的球在播 → 完全隐藏（聚焦只剩播放球 + 日蚀）；否则没入淡出（水下仍留 0.4 锚点）
        el.style.opacity = dim ? '0' : String(Math.max(0.4, 1 - sub * 1.5));
        // 水下对象仍可点（H 规格）；别的球在播时让出交互（其他球已隐藏）
        el.style.pointerEvents = dim ? 'none' : 'auto';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [nodes, playingIdRef, waterOn, depthModel]);

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
    // /test3 task 4：把光标(屏幕)逆投影回 sim 坐标 → 球的投影位置正好落在光标处（缩放/视差/层级波动下仍跟手）。
    const { x, y } = unproject(e.clientX, e.clientY, renderDepth(node.z, node._waveZ ?? 0), currentCtx());
    setNodeDrag(node, x, y);
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
