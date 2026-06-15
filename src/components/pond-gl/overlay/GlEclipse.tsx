'use client';

import { useEffect, useRef } from 'react';
import type { GlSim } from '../spheres/use-gl-sim';

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
  const { nodes, playingIdRef } = glSim;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const g = gRef.current;
      if (g) {
        const pid = playingIdRef.current;
        const pn = pid ? nodes.find((n) => n.id === pid) : null;
        if (pn && pn.x != null && pn.y != null) {
          g.setAttribute('transform', `translate(${pn.x},${pn.y}) scale(${pn.radius / 50})`);
          g.style.opacity = '1';
        } else {
          g.style.opacity = '0';
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [nodes, playingIdRef]);

  return (
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
        <circle r="220" fill="url(#gl-eclipse-halo)" />
        <circle r="50" fill="black" />
        <circle r="51" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.92" />
        <rect x="-14" y="-22" width="9" height="44" fill="white" opacity="0.1" />
        <rect x="5" y="-22" width="9" height="44" fill="white" opacity="0.1" />
      </g>
    </svg>
  );
}
