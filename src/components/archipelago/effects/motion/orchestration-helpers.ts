'use client';
// Phase 8 Lane E — SphereCanvas 编排辅助：dragWake 拖拽检测 + clickSplash 点击水花。
// 从 SphereCanvas 抽出以守 220 行硬线；纯逻辑，无 JSX。
import { useEffect } from 'react';
import type { SimNode } from '../../sphere-config';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * §2.16 dragWake — 在 SVG 层独立检测"球上拖拽"（不碰 d3 attachDrag）：
 * 指针按下落在 [data-sphere] 上后跟踪移动，每行进 30-50px 喂一个 SVG 本地坐标点给
 * WaterWake 微涟漪池（window 'water-wake:drag'）。flag 由 WaterWake 内部判定，本钩常驻轻量。
 */
export function useDragWakeFeed(svgRef: React.RefObject<SVGSVGElement | null>): void {
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let dragging = false;
    let lastX = 0, lastY = 0, step = 38;
    const local = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest('[data-sphere]')) return;
      dragging = true;
      const p = local(e);
      lastX = p.x; lastY = p.y; step = 30 + Math.random() * 20;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const p = local(e);
      if (Math.hypot(p.x - lastX, p.y - lastY) >= step) {
        window.dispatchEvent(new CustomEvent('water-wake:drag', { detail: { x: p.x, y: p.y } }));
        lastX = p.x; lastY = p.y; step = 30 + Math.random() * 20;
      }
    };
    const onUp = () => { dragging = false; };
    svg.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      svg.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [svgRef]);
}

/**
 * F1 clickSplash — 在播放球心迸 3-5 个 r1-2px 一次性光点（随机方向抛出 8-16px + 淡出，
 * 0.4-0.6s 用后即删，CSS class click-splash 驱动）。在 SphereCanvas 层调，不碰 SphereNode。
 */
export function spawnClickSplash(layer: SVGGElement | null, n: SimNode): void {
  if (!layer || n.x == null || n.y == null) return;
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const dot = document.createElementNS(SVG_NS, 'circle');
    const ang = Math.random() * 6.283, dist = 8 + Math.random() * 8;
    dot.setAttribute('cx', String(n.x));
    dot.setAttribute('cy', String(n.y));
    dot.setAttribute('r', String(1 + Math.random()));
    dot.setAttribute('fill', 'var(--pond-light)');
    dot.setAttribute('class', 'click-splash');
    dot.style.setProperty('--sx', `${Math.cos(ang) * dist}px`);
    dot.style.setProperty('--sy', `${Math.sin(ang) * dist}px`);
    dot.style.animationDuration = `${0.4 + Math.random() * 0.2}s`;
    layer.appendChild(dot);
    window.setTimeout(() => { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 700);
  }
}
