'use client';

import { useEffect, useRef } from 'react';
import type { GlSim } from '../spheres/use-gl-sim';
import { project, applyFloat } from '../sphere-projection';
import { getPointerFx, getCameraFx, depthOf } from '../pointer-fx';
import { getEffectiveWaterLevel } from '../water/water-level';
import ShowcaseOverlay from '../showcase/ShowcaseOverlay';
import { sampleShowcase, setShowcasePose } from '../showcase/showcase-state';
import P9StageOverlay from '../p9/consumers/P9StageOverlay';
import { sampleP9 } from '../p9/runtime/p9-sampler';
import { sampleP9EclipsePose } from '../p9/consumers/p9-eclipse';

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
  const coreRef = useRef<SVGGElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const echoRingRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const haloGradientRef = useRef<SVGRadialGradientElement>(null);
  const { nodes, playingIdRef } = glSim;

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
      const p9 = sampleP9(now);
      const cue = sampleP9EclipsePose(p9);
      const core = coreRef.current;
      if (core) {
        const pull = eccentric.energy * (7 + Math.sin(eccentric.progress * Math.PI) * 5);
        core.setAttribute('transform', `translate(${Math.cos(eccentric.angle) * pull + cue.coreX} ${Math.sin(eccentric.angle) * pull + cue.coreY}) scale(${(1 - eccentric.energy * 0.055) * cue.coreScale})`);
      }
      const ring = ringRef.current;
      if (ring) {
        ring.setAttribute('stroke-width', String(cue.ringWidth + exchange.energy * 3.2));
        ring.setAttribute('stroke-opacity', String(Math.min(1, 0.92 + exchange.energy * 0.08)));
        ring.setAttribute('stroke-dasharray', stitch.energy > 0 ? '255 65' : 'none');
        ring.setAttribute('transform', `rotate(${stitch.progress * 115 + cue.rotation}) scale(${cue.ringScale})`);
      }
      const echoRing = echoRingRef.current;
      if (echoRing) {
        echoRing.setAttribute('transform', `translate(${-cue.echo * 12} ${cue.echo * 5}) rotate(${-cue.rotation}) scale(${1 + cue.echo * 0.18})`);
        echoRing.style.opacity = String(cue.echo * 0.75);
      }
      const halo = haloRef.current;
      if (halo) {
        const accent = Math.max(exchange.energy * 0.18, transit.energy * 0.42);
        halo.setAttribute('transform', `scale(${(1 + accent) * cue.haloScale})`);
        halo.style.opacity = String(Math.min(1, cue.haloOpacity + accent * 0.18));
        const colorFx = cue.hueStrength > 0.01 ? `saturate(${1.4 + cue.hueStrength * 0.18}) contrast(1.28)` : '';
        halo.style.filter = `${colorFx} blur(${cue.haloBlur}px)`.trim();
      }
      if (haloGradientRef.current) haloGradientRef.current.style.color = cue.hueStrength > 0.01
        ? cue.hueColor : 'white';
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
    <svg className="pointer-events-none fixed inset-0 z-[23] h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient ref={haloGradientRef} id="gl-eclipse-halo" style={{ color: 'white' }}>
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="22%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="24%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="36%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* opacity 0↔1 缓动（0.45s ≈ 球淡出 0.5s 同步）；transform 由 rAF 每帧写 */}
      <g ref={gRef} style={{ opacity: 0, transition: 'opacity 0.45s ease' }}>
        <circle ref={haloRef} r="220" fill="url(#gl-eclipse-halo)" />
        <g ref={coreRef}>
          <circle r="50" fill="black" />
        </g>
        <circle ref={ringRef} r="51" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.92" />
        <circle ref={echoRingRef} r="54" fill="none" stroke="#c8e7df" strokeWidth="1.4" style={{ opacity: 0 }} />
      </g>
    </svg>
    <ShowcaseOverlay />
    <P9StageOverlay />
    </>
  );
}
