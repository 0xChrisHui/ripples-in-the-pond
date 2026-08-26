'use client';

import { useEffect, useRef } from 'react';
import type { GlSim } from '../spheres/use-gl-sim';
import { project, applyFloat } from '../sphere-projection';
import { getPointerFx, getCameraFx, depthOf } from '../pointer-fx';
import { getEffectiveWaterLevel } from '../water/water-level';
import { KEY_FX_EVENT, type KeyFxDetail } from '../key-fx/key-fx-events';
import { prefersReducedMotion } from '../reduced-motion';
import ShowcaseOverlay from '../showcase/ShowcaseOverlay';
import { sampleShowcase, setShowcasePose } from '../showcase/showcase-state';

/**
 * I2 — GL 页日蚀层（移植共享 SVG EclipseLayer 的视觉，不碰原组件）。
 *
 * 播放某球时其他球隐去（SphereInstances dim→0 / SphereOverlay 标题 opacity 0），这颗球位置叠：
 * 日冕 halo + 黑盘 + 白环 + 暗 pause 条 = 日蚀焦点。黑盘半径 = 球半径（scale = radius/50，沿用旧 baseS）。
 * 每帧 rAF 读 glSim.playingIdRef + nodes 定位（同 SphereOverlay/WaterLevelIndicator 范式，不触发 React 重渲染）。
 * DOM/SVG overlay（非进 GL）→ 不被水面折射、与命中层同坐标天然对齐；pointer-events-none → 点击穿透到命中层暂停。
 */
export default function GlEclipse({ glSim }: { glSim: GlSim }) {
  const gRef = useRef<SVGGElement>(null);
  const coronaRef = useRef<SVGGElement>(null);
  const coreRef = useRef<SVGGElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const accentRef = useRef({ startedAt: -99, endsAt: -99, angle: 0, strength: 0 });
  const { nodes, playingIdRef } = glSim;

  useEffect(() => {
    const onKeyFx = (event: Event) => {
      if (!playingIdRef.current || prefersReducedMotion()) return;
      const detail = (event as CustomEvent<KeyFxDetail>).detail;
      if (!detail.family || detail.x == null || detail.y == null) return;
      const now = performance.now() / 1000;
      const nextAngle = Math.atan2(0.5 - detail.y, detail.x - 0.5);
      const accent = accentRef.current;
      if (now < accent.endsAt) {
        accent.endsAt = Math.min(now + 1.8, accent.endsAt + 0.22);
        accent.angle += (nextAngle - accent.angle) * 0.35;
        accent.strength = Math.min(1, accent.strength + 0.16);
      } else {
        accent.startedAt = now;
        accent.endsAt = now + 1.8;
        accent.angle = nextAngle;
        accent.strength = 0.72;
      }
    };
    window.addEventListener(KEY_FX_EVENT, onKeyFx);
    return () => window.removeEventListener(KEY_FX_EVENT, onKeyFx);
  }, [playingIdRef]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const g = gRef.current;
      if (g) {
        const pid = playingIdRef.current;
        const pn = pid ? nodes.find((n) => n.id === pid) : null;
        if (pn && pn.x != null && pn.y != null) {
          // /test3 task 4：与 GL 实例/命中层同款投影 → 日蚀盘贴着投影后的播放球（缩放/视差下不偏移）。
          const { mx, my } = getPointerFx();
          const c = getCameraFx();
          const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
          // applyFloat：日蚀盘跟随浮动的播放球（同 GL 球/命中层那套呼吸+径向轻浮）→ 不再被甩在原位
          const p = applyFloat(project(pn.x, pn.y, depthOf(pn), { cx, cy, mx, my, focusZ: getEffectiveWaterLevel(), dof: c.dof, perspective: c.perspective, parallax: c.parallax }, pn), pn, cx, cy);
          const eclipseScale = (pn.radius * p.scale) / 50;
          g.setAttribute('transform', `translate(${p.sx},${p.sy}) scale(${eclipseScale})`);
          g.style.opacity = '1';
          setShowcasePose({ active: true, x: p.sx / window.innerWidth, y: p.sy / window.innerHeight, scale: eclipseScale });
        } else {
          g.style.opacity = '0';
          setShowcasePose({ active: false, x: 0.5, y: 0.5, scale: 1 });
        }
      }
      const now = performance.now() / 1000;
      const eccentric = sampleShowcase('eccentric', now);
      const exchange = sampleShowcase('motes', now);
      const stitch = sampleShowcase('stitch', now);
      const transit = sampleShowcase('transit', now);
      const core = coreRef.current;
      if (core) {
        const pull = eccentric.energy * (7 + Math.sin(eccentric.progress * Math.PI) * 5);
        core.setAttribute('transform', `translate(${Math.cos(eccentric.angle) * pull} ${Math.sin(eccentric.angle) * pull}) scale(${1 - eccentric.energy * 0.055})`);
      }
      const ring = ringRef.current;
      if (ring) {
        ring.setAttribute('stroke-width', String(1.2 + exchange.energy * 3.2));
        ring.setAttribute('stroke-opacity', String(Math.min(1, 0.92 + exchange.energy * 0.08)));
        ring.setAttribute('stroke-dasharray', stitch.energy > 0 ? '255 65' : 'none');
        ring.setAttribute('transform', stitch.energy > 0 ? `rotate(${stitch.progress * 115})` : '');
      }
      const halo = haloRef.current;
      if (halo) {
        const accent = Math.max(exchange.energy * 0.18, transit.energy * 0.42);
        halo.setAttribute('transform', `scale(${1 + accent})`);
        halo.style.opacity = String(0.82 + accent * 0.18);
      }
      const corona = coronaRef.current;
      if (corona) {
        const accent = accentRef.current;
        if (playingIdRef.current && now < accent.endsAt) {
          const life = Math.max(0.001, accent.endsAt - accent.startedAt);
          const progress = Math.min(1, (now - accent.startedAt) / life);
          const attack = Math.min(1, progress / 0.12);
          const release = Math.min(1, (accent.endsAt - now) / 0.7);
          const energy = attack * release * accent.strength;
          const degrees = accent.angle * (180 / Math.PI) + progress * 72;
          corona.setAttribute('transform', `rotate(${degrees}) scale(${0.94 + energy * 0.12})`);
          corona.style.opacity = String(energy * 0.72);
        } else {
          corona.style.opacity = '0';
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setShowcasePose({ active: false, x: 0.5, y: 0.5, scale: 1 });
    };
  }, [nodes, playingIdRef]);

  return (
    <>
    <svg className="pointer-events-none fixed inset-0 z-20 h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="gl-eclipse-halo">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="22%" stopColor="white" stopOpacity="0" />
          <stop offset="24%" stopColor="white" stopOpacity="0.55" />
          <stop offset="36%" stopColor="white" stopOpacity="0.32" />
          <stop offset="60%" stopColor="white" stopOpacity="0.10" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* opacity 0↔1 缓动（0.45s ≈ 球淡出 0.5s 同步）；transform 由 rAF 每帧写 */}
      <g ref={gRef} style={{ opacity: 0, transition: 'opacity 0.45s ease' }}>
        <circle ref={haloRef} r="220" fill="url(#gl-eclipse-halo)" />
        <g ref={coreRef}>
          <circle r="50" fill="black" />
          <rect x="-14" y="-22" width="9" height="44" fill="white" opacity="0.1" />
          <rect x="5" y="-22" width="9" height="44" fill="white" opacity="0.1" />
        </g>
        <circle ref={ringRef} r="51" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.92" />
        <g ref={coronaRef} style={{ opacity: 0 }}>
          <circle r="68" fill="none" stroke="#d8ecdf" strokeWidth="2.2"
            strokeLinecap="round" strokeDasharray="42 24 8 36" strokeOpacity="0.7" />
          <circle r="84" fill="none" stroke="#91b8c0" strokeWidth="1.1"
            strokeLinecap="round" strokeDasharray="18 42 56 31" strokeOpacity="0.48" />
        </g>
      </g>
    </svg>
    <ShowcaseOverlay />
    </>
  );
}
