'use client';

import { useEffect, useRef } from 'react';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_AUTO = 4; // 自动 spawn 时同时存在的上限
const MAX_TOTAL = 8; // 手动 + 自动叠加最大值（防 GPU 累积闪烁）

/**
 * BackgroundRipples — v22：
 * - 自动 spawn 受 MAX_AUTO=4 限制（已有 >= 4 时跳过 tick）
 * - 用户点击立即 spawn（不挤自动配额，可叠到 MAX_TOTAL=8）
 * - 超 MAX_TOTAL 强制移除最老（防 GPU layer 累积）
 * - 每次 spawn dispatch 'bg-ripple:wave' 让 SphereCanvas 推球
 */
export default function BackgroundRipples() {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;
    const timers: number[] = [];

    const spawnAt = (x: number, y: number, manual: boolean) => {
      if (cancelled || !svg) return;
      // 总上限 8 — 超了强制移除最老（防 GPU 累积）
      while (svg.children.length >= MAX_TOTAL && svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }
      // 自动模式：现存 >= 4 时跳过本次（不抢手动配额）
      if (!manual && svg.children.length >= MAX_AUTO) return;
      lastPosRef.current = { x, y };
      const size = 220 + Math.random() * 260;
      const duration = 14.5 + Math.random() * 5.8;
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      c.setAttribute('r', String(size));
      c.setAttribute('fill', 'none');
      // v25：手动 stroke 用 white + CSS keyframe 控 stroke-width/opacity 平滑渐变
      // 前 12%（≈2s）从 strong 渐到普通值，之后曲线和自动涟漪完全一致
      if (manual) {
        c.setAttribute('stroke', 'white');
        c.setAttribute('class', 'bg-ripple-manual');
      } else {
        c.setAttribute('stroke', 'rgba(255,255,255,0.27)');
        c.setAttribute('stroke-width', '1.4');
        c.setAttribute('class', 'bg-ripple');
      }
      c.style.animationDuration = `${duration}s`;
      svg.appendChild(c);
      window.dispatchEvent(
        new CustomEvent('bg-ripple:wave', { detail: { x, y, size, duration } }),
      );
      const removeId = window.setTimeout(() => {
        if (c.parentNode) c.parentNode.removeChild(c);
      }, duration * 1000 + 200);
      timers.push(removeId);
    };

    const spawnAuto = (near = false) => {
      if (cancelled || !svg) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const last = lastPosRef.current;
      const x = near && last
        ? Math.max(20, Math.min(w - 20, last.x + (Math.random() - 0.5) * 300))
        : Math.random() * w;
      const y = near && last
        ? Math.max(20, Math.min(h - 20, last.y + (Math.random() - 0.5) * 300))
        : Math.random() * h;
      spawnAt(x, y, false);
    };

    const tick = () => {
      if (cancelled) return;
      spawnAuto(false);
      if (Math.random() < 0.45) {
        const extra = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < extra; i++) {
          const delay = 240 + Math.random() * 360;
          const id = window.setTimeout(() => spawnAuto(true), delay * (i + 1));
          timers.push(id);
        }
      }
      const nextDelay = 2400 + Math.random() * 1100;
      const nextId = window.setTimeout(tick, nextDelay);
      timers.push(nextId);
    };

    const startId = window.setTimeout(tick, 600);
    timers.push(startId);

    // 用户点击空白立即触发涟漪（manual=true 不受 MAX_AUTO 限制）
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest('button, a, input, select, textarea, [role="button"]')) return;
      if (t.closest('[data-sphere]')) return;
      spawnAt(e.clientX, e.clientY, true);
    };
    window.addEventListener('click', onClick);

    // v34 — 切 group / 重建 sim 时清屏 + 暂停 2s 等球稳定后再 spawn
    const onReset = () => {
      if (cancelled || !svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      timers.forEach((t) => window.clearTimeout(t));
      timers.length = 0;
      lastPosRef.current = null;
      const id = window.setTimeout(tick, 2000);
      timers.push(id);
    };
    window.addEventListener('archipelago:reset', onReset);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('click', onClick);
      window.removeEventListener('archipelago:reset', onReset);
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
