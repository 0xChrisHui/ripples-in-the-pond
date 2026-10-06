'use client';
import { useEffect, useRef, type RefObject } from 'react';
import EclipseBody from '../../../pond-gl-test3/eclipse-base/EclipseBody';
import { sampleEclipseBase } from '../../../pond-gl-test3/eclipse-base/eclipse-motion';
import type { CircleFrame } from './circle-state';

/** 与首页共用基础日食，曲目页不订阅 P9 或 Showcase。 */
export default function CircleEclipse({ frame }: { frame: RefObject<CircleFrame> }) {
  const ring = useRef<SVGCircleElement>(null);
  const halo = useRef<SVGCircleElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const { time, hover, reduced } = frame.current;
      const pose = sampleEclipseBase(time, hover, reduced);
      ring.current?.setAttribute('stroke-width', String(pose.ringWidth));
      halo.current?.setAttribute('transform', `scale(${pose.haloScale})`);
      if (halo.current) halo.current.style.opacity = String(pose.haloOpacity);
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [frame]);
  return <svg className="track-circle__eclipse" viewBox="0 0 640 640" aria-hidden="true">
    <g data-circle-eclipse="true" transform="translate(320 320) scale(3.584)">
      <EclipseBody ringRef={ring} haloRef={halo} />
    </g>
  </svg>;
}
