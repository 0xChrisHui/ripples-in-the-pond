'use client';

import { useEffect, useRef } from 'react';
import { getWaterLevel, getLastWheelAt } from './test2-water-level';

/**
 * /test2 专属水位指示 —— 与 /test1 的 `pond-gl/overlay/WaterLevelIndicator.tsx` 逐字同构，
 * 唯一区别：读 `./test2-water-level`（独立 store）→ 与 /test1 水位互不影响（task 2）。
 */
export default function Test2WaterLevelIndicator() {
  const barRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const lvl = getWaterLevel();
      const idle = performance.now() - getLastWheelAt();
      const op = idle < 1200 ? 1 : Math.max(0, 1 - (idle - 1200) / 800);
      if (barRef.current) barRef.current.style.opacity = String(op);
      if (markRef.current) markRef.current.style.bottom = `${lvl * 100}%`;
      if (labelRef.current) labelRef.current.textContent = `水位 ${Math.round(lvl * 100)}%`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={barRef}
      style={{ opacity: 0 }}
      className="pointer-events-none fixed left-3 top-1/2 z-40 h-56 -translate-y-1/2"
    >
      <div className="relative h-full w-px bg-white/15">
        <div
          ref={markRef}
          style={{ bottom: '0%' }}
          className="absolute -left-1.5 h-0.5 w-3 -translate-y-1/2 bg-sky-300/80 shadow-[0_0_6px] shadow-sky-300/50"
        />
      </div>
      <div ref={labelRef} className="absolute -left-1 -top-5 whitespace-nowrap text-[10px] text-white/50">
        水位 0%
      </div>
    </div>
  );
}
