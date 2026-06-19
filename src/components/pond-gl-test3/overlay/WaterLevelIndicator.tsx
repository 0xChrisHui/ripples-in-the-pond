'use client';

import { useEffect, useRef } from 'react';
import { getWaterLevel, getLastWheelAt } from '../water/water-level';

/**
 * G6 — 左缘水位指示（DOM 细刻度）。滚轮时淡入、静止 1.2s 后淡出。
 * H6：从右缘移到左缘，给右下角的「调色 + 波纹/运动」参数板栏让位（否则被面板盖住）。
 *
 * 每帧 rAF 直读 water-level store 写样式，不触发 React 重渲染（同 SphereOverlay 范式）。
 * 刻度条底=水位 0、顶=水位 1；青色游标随 current 上下移动。
 */
export default function WaterLevelIndicator() {
  const barRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const lvl = getWaterLevel();
      const idle = performance.now() - getLastWheelAt();
      // 滚动后 1.2s 全显，再 0.8s 渐隐到 0
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
      {/* 竖刻度线 */}
      <div className="relative h-full w-px bg-white/15">
        {/* 青色游标：随水位上下；bottom 0%→100% 对应 z 域底→顶 */}
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
