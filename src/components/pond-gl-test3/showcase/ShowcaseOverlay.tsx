'use client';

import { useEffect, useRef } from 'react';
import { getShowcasePose, sampleShowcase } from './showcase-state';

/** C 花瓣缝合 + E 月影过境：共享日食坐标，覆盖层只负责稀有的新痕迹。 */
export default function ShowcaseOverlay() {
  const localRef = useRef<SVGGElement>(null);
  const leftRef = useRef<SVGGElement>(null);
  const rightRef = useRef<SVGGElement>(null);
  const leftThreadRef = useRef<SVGPathElement>(null);
  const rightThreadRef = useRef<SVGPathElement>(null);
  const transitRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now() / 1000;
      const pose = getShowcasePose();
      const stitch = sampleShowcase('stitch', now);
      const transit = sampleShowcase('transit', now);
      const incoming = Math.min(1, stitch.progress / 0.5);
      const broken = Math.max(0, (stitch.progress - 0.58) / 0.42);
      const draw = Math.min(1, stitch.progress / 0.46);
      const local = localRef.current;
      if (local) {
        local.setAttribute('transform', `translate(${pose.x * innerWidth} ${pose.y * innerHeight}) scale(${pose.scale})`);
        local.style.opacity = String(stitch.energy);
      }
      leftRef.current?.setAttribute('transform', `translate(${-118 + incoming * 60 - broken * 72} ${broken * 18}) rotate(${-18 - broken * 82}) scale(${1 + incoming * 1.8} 1)`);
      rightRef.current?.setAttribute('transform', `translate(${118 - incoming * 60 + broken * 72} ${-broken * 18}) rotate(${162 + broken * 82}) scale(${1 + incoming * 1.8} 1)`);
      const dash = String(150 * (1 - draw));
      if (leftThreadRef.current) leftThreadRef.current.style.strokeDashoffset = dash;
      if (rightThreadRef.current) rightThreadRef.current.style.strokeDashoffset = dash;
      const transitRect = transitRef.current;
      if (transitRect) {
        const w = innerWidth;
        transitRect.setAttribute('x', String(-w * 1.25 + transit.progress * w * 2.5));
        transitRect.setAttribute('width', String(w * 1.35));
        transitRect.setAttribute('height', String(innerHeight));
        transitRect.style.opacity = String(transit.energy * 0.86);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg className="pointer-events-none fixed inset-0 z-[21] h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="p9-transit-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#020807" stopOpacity="0" />
          <stop offset="0.32" stopColor="#020605" stopOpacity="0.76" />
          <stop offset="0.62" stopColor="#000" stopOpacity="0.94" />
          <stop offset="1" stopColor="#071113" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect ref={transitRef} y="0" fill="url(#p9-transit-gradient)" style={{ opacity: 0 }} />
      <g ref={localRef} style={{ opacity: 0 }}>
        <path ref={leftThreadRef} d="M-122 0 C-98 -12 -78 16 -8 0" fill="none" stroke="#dff5ec"
          strokeWidth="1.5" strokeLinecap="round" strokeDasharray="150" />
        <path ref={rightThreadRef} d="M122 0 C98 12 78 -16 8 0" fill="none" stroke="#f3d8e4"
          strokeWidth="1.5" strokeLinecap="round" strokeDasharray="150" />
        <g ref={leftRef}><ellipse rx="16" ry="6" fill="#ccebdd" opacity="0.9" /></g>
        <g ref={rightRef}><ellipse rx="16" ry="6" fill="#f3cddd" opacity="0.9" /></g>
      </g>
    </svg>
  );
}
