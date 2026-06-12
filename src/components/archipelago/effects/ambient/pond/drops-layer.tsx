'use client';

import { useEffect, useRef } from 'react';

/**
 * 落滴 / 细雨 (P8-B §2.10 drops + P8-F F4 rain) — 抽象涟漪发生器，"涟漪有源"原则的氛围级示范。
 *
 * 意象：一滴月光/一滴音落进塘里。纯抽象（光点坠落 → 触水 → 化开），无叶无花。
 * 落滴入水瞬间：dispatch 'bg-ripple:wave'（借总线推球）+ 'bg-ripple:spawn'（画涟漪圈）。
 * - drops 档：每 25-45s 一粒，同屏 ≤2，涟漪 size≈90、prio 1（氛围但有源，走画圈）。
 * - rain 档（rain=1 覆盖 drops 节奏）：每 2-5s，同屏 ≤6，滴更小更快，涟漪走 prio 3 氛围级（只用剩余配额）。
 * 性能：≤6 元素，全 transform/opacity。document.hidden 跳过。
 */

interface Props {
  /** 强化档：rain=1 时覆盖 drops 节奏（间隔降至 2-5s、同屏 ≤6、更小更快） */
  rain?: boolean;
}

const FALL_MIN_VH = 35;
const FALL_RANGE_VH = 40; // 水位 35-75vh

export default function DropsLayer({ rain = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const timers: number[] = [];
    let active = 0;

    const cfg = rain
      ? { gapMin: 2000, gapRange: 3000, maxOnscreen: 6, rDrop: 1.0, fallMin: 0.9, fallRange: 0.6, rippleSize: 55, ripplePrio: 3, dropOpacity: 0.4 }
      : { gapMin: 25000, gapRange: 20000, maxOnscreen: 2, rDrop: 2.0, fallMin: 1.2, fallRange: 0.8, rippleSize: 90, ripplePrio: 1, dropOpacity: 0.5 };

    const spawnDrop = () => {
      if (cancelled || active >= cfg.maxOnscreen) return;
      active++;
      const xVw = 8 + Math.random() * 84; // 避开极边缘
      const waterVh = FALL_MIN_VH + Math.random() * FALL_RANGE_VH;
      const driftPx = (Math.random() - 0.5) * 24; // ≤12px 单向漂
      const fallS = cfg.fallMin + Math.random() * cfg.fallRange;
      const r = cfg.rDrop * (0.75 + Math.random() * 0.5);

      const drop = document.createElement('div');
      drop.style.position = 'fixed';
      drop.style.left = `${xVw}vw`;
      drop.style.top = '-5vh';
      drop.style.width = `${r * 2}px`;
      drop.style.height = `${r * 2}px`;
      drop.style.borderRadius = '50%';
      drop.style.background = 'var(--pond-light)';
      drop.style.opacity = String(cfg.dropOpacity);
      drop.style.willChange = 'transform, opacity';
      drop.style.setProperty('--drop-fall', `${waterVh + 5}vh`);
      drop.style.setProperty('--drop-drift', `${driftPx}px`);
      drop.style.animation = `drop-fall ${fallS}s ease-in forwards`;
      host.appendChild(drop);

      // 坠落结束 → 触水：滴淡出 + 推球 + 画圈
      const land = window.setTimeout(() => {
        if (cancelled) { if (drop.parentNode) drop.remove(); active--; return; }
        const x = (xVw / 100) * window.innerWidth + driftPx;
        const y = (waterVh / 100) * window.innerHeight;
        window.dispatchEvent(new CustomEvent('bg-ripple:wave', { detail: { x, y, size: cfg.rippleSize, duration: 8 } }));
        window.dispatchEvent(new CustomEvent('bg-ripple:spawn', { detail: { x, y, size: cfg.rippleSize, duration: 8, prio: cfg.ripplePrio } }));
        drop.remove();
        active--;
      }, fallS * 1000);
      timers.push(land);
    };

    const tick = () => {
      if (cancelled) return;
      if (!document.hidden) spawnDrop();
      timers.push(window.setTimeout(tick, cfg.gapMin + Math.random() * cfg.gapRange));
    };
    timers.push(window.setTimeout(tick, 1500 + Math.random() * 2000));

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      while (host.firstChild) host.removeChild(host.firstChild);
    };
  }, [rain]);

  // keyframe drop-fall 在 app/pond-effects.css「Lane B」区块
  return (
    <div ref={hostRef} className="pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />
  );
}
