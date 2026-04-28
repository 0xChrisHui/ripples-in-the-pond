'use client';

import { useEffect, useRef } from 'react';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_RIPPLES = 4;

/**
 * 背景全屏随机涟漪 — v20：
 * - max 4 同时存在（避免 GPU layer 累积）
 * - 45% 概率连发 1-2 个在 ±150px 邻近位置
 * - stroke opacity 0.27 / width 1.4 / size 220-480 / duration 14.5-20.3s（×1.7 慢）
 * - 单发主时钟 2400-3500ms（spawn 频率也降）
 */
export default function BackgroundRipples() {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;
    const timers: number[] = [];

    const spawnOne = (near = false) => {
      if (cancelled || !svg) return;
      while (svg.children.length >= MAX_RIPPLES && svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      let x: number;
      let y: number;
      const last = lastPosRef.current;
      if (near && last) {
        x = Math.max(20, Math.min(w - 20, last.x + (Math.random() - 0.5) * 300));
        y = Math.max(20, Math.min(h - 20, last.y + (Math.random() - 0.5) * 300));
      } else {
        x = Math.random() * w;
        y = Math.random() * h;
      }
      lastPosRef.current = { x, y };

      const size = 220 + Math.random() * 260;
      // v20：再 ×1.7 → 14.5-20.3s（视觉上接近静止扩散，节约 paint）
      const duration = 14.5 + Math.random() * 5.8;

      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      c.setAttribute('r', String(size));
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', 'rgba(255,255,255,0.27)');
      c.setAttribute('stroke-width', '1.4');
      c.setAttribute('class', 'bg-ripple');
      c.style.animationDuration = `${duration}s`;
      svg.appendChild(c);

      const removeId = window.setTimeout(() => {
        if (c.parentNode) c.parentNode.removeChild(c);
      }, duration * 1000 + 200);
      timers.push(removeId);
    };

    const tick = () => {
      if (cancelled) return;
      spawnOne(false);
      // 45% 概率连发 1-2 个邻近涟漪
      if (Math.random() < 0.45) {
        const extra = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < extra; i++) {
          const delay = 240 + Math.random() * 360;
          const id = window.setTimeout(() => spawnOne(true), delay * (i + 1));
          timers.push(id);
        }
      }
      // 速度降 + spawn 频率也降低（max 4 限制下不易撞上限）
      const nextDelay = 2400 + Math.random() * 1100;
      const nextId = window.setTimeout(tick, nextDelay);
      timers.push(nextId);
    };

    const startId = window.setTimeout(tick, 600);
    timers.push(startId);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
