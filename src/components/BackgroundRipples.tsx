'use client';

import { useEffect, useRef } from 'react';
import { getPondTilt, subscribePondTilt } from './archipelago/hooks/pond/use-pond-tilt';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_AUTO = 4;   // P3 氛围涟漪同时存在的配额（不挤占用户交互）
const MAX_TOTAL = 10; // 手动 + 自动叠加最大值（8-B §2.1.6：实测后从 8 上调到 ≤12）

/**
 * BackgroundRipples — Phase 8-B S1 升级为世界观核心涟漪总线。
 *
 * - 椭圆透视涟漪：ry = rx × POND_TILT_RATIO（默认 1.0 = 正圆 = 现状），运行时随机位 slider 响应。
 * - 月光青白色：stroke 走 --pond-ripple / --pond-light token（现状兼容值 = 白）。
 * - 三级优先调度（§2.1.6）：
 *   P1 用户直接交互（点击空白 / hoverRipple / groupWave）——永不丢弃，必要时挤掉 P3；
 *   P2 播放叙事（beatRipple / echoRipple）——同源限流由调用方负责；
 *   P3 氛围（自动涟漪 / drops / rain）——只用 MAX_AUTO 剩余配额。
 * - `bg-ripple:spawn` 事件：外部（hoverRipple / drops / waterWake 等）只画圈、不推球。
 * - `bg-ripple:wave` 事件：自动 / 点击路径继续推球（语义不变）。
 */
export default function BackgroundRipples() {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;
    const timers: number[] = [];

    // 满员时按"低优先、最老优先"腾位；不为更低优先的来者挤掉更高优先的在场者。
    const makeRoom = (incomingPrio: number): boolean => {
      while (svg.children.length >= MAX_TOTAL) {
        let victim: Element | null = null;
        for (const order of [3, 2, 1]) {
          for (const ch of Array.from(svg.children)) {
            if (Number(ch.getAttribute('data-prio')) === order) { victim = ch; break; }
          }
          if (victim) break;
        }
        if (!victim) return false;
        if (Number(victim.getAttribute('data-prio')) < incomingPrio) return false;
        svg.removeChild(victim);
      }
      return true;
    };

    // 画一个涟漪椭圆（不推球）。kind: 'auto' | 'manual' | 'once'
    const draw = (
      x: number, y: number,
      opts: { prio: number; kind: 'auto' | 'manual' | 'once'; size: number; duration: number },
    ) => {
      if (cancelled || !svg) return;
      const { prio, kind, size, duration } = opts;
      if (prio === 3) {
        const ambient = Array.from(svg.children)
          .filter((c) => c.getAttribute('data-prio') === '3').length;
        if (svg.children.length >= MAX_TOTAL || ambient >= MAX_AUTO) return;
      } else if (svg.children.length >= MAX_TOTAL && !makeRoom(prio)) {
        return;
      }
      lastPosRef.current = { x, y };
      const tilt = getPondTilt();
      const el = document.createElementNS(SVG_NS, 'ellipse');
      el.setAttribute('cx', String(x));
      el.setAttribute('cy', String(y));
      el.setAttribute('rx', String(size));
      el.setAttribute('ry', String(size * tilt));
      el.setAttribute('fill', 'none');
      el.setAttribute('data-prio', String(prio));
      el.setAttribute('data-rx', String(size));
      if (kind === 'manual') {
        el.style.stroke = 'var(--pond-light)';
        el.setAttribute('class', 'bg-ripple-manual');
      } else if (kind === 'once') {
        el.style.stroke = 'var(--pond-ripple)';
        el.setAttribute('class', 'ripple-once');
      } else {
        el.style.stroke = 'var(--pond-ripple)';
        el.style.strokeOpacity = '0.27';
        el.setAttribute('stroke-width', '1.4');
        el.setAttribute('class', 'bg-ripple');
      }
      el.style.animationDuration = `${duration}s`;
      svg.appendChild(el);
      const removeId = window.setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, duration * 1000 + 200);
      timers.push(removeId);
    };

    // 内部 spawn（自动 / 点击）——画圈 + 推球
    const spawnAt = (x: number, y: number, manual: boolean) => {
      const size = 220 + Math.random() * 260;
      const duration = 14.5 + Math.random() * 5.8;
      draw(x, y, { prio: manual ? 1 : 3, kind: manual ? 'manual' : 'auto', size, duration });
      window.dispatchEvent(
        new CustomEvent('bg-ripple:wave', { detail: { x, y, size, duration } }),
      );
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
      if (document.hidden) {
        timers.push(window.setTimeout(tick, 2400));
        return;
      }
      spawnAuto(false);
      if (Math.random() < 0.45) {
        const extra = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < extra; i++) {
          const delay = 240 + Math.random() * 360;
          timers.push(window.setTimeout(() => spawnAuto(true), delay * (i + 1)));
        }
      }
      timers.push(window.setTimeout(tick, 2400 + Math.random() * 1100));
    };
    timers.push(window.setTimeout(tick, 600));

    // 用户点击空白立即触发涟漪（P1，不受配额限制）
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest('button, a, input, select, textarea, [role="button"]')) return;
      if (t.closest('[data-sphere]')) return;
      spawnAt(e.clientX, e.clientY, true);
    };
    window.addEventListener('click', onClick);

    // §2.10/§2.14 — 外部画圈事件（hoverRipple / drops / waterWake…）：只画不推球。
    // detail: { x, y, size?, duration?, prio?, once? }
    const onSpawn = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      if (typeof d.x !== 'number' || typeof d.y !== 'number') return;
      draw(d.x, d.y, {
        prio: d.prio ?? 1,
        kind: d.once === false ? 'auto' : 'once',
        size: d.size ?? 60,
        duration: d.duration ?? 6,
      });
    };
    window.addEventListener('bg-ripple:spawn', onSpawn);

    // 切 group / 重建 sim 时清屏 + 暂停 2s 等球稳定后再 spawn
    const onReset = () => {
      if (cancelled || !svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      timers.forEach((t) => window.clearTimeout(t));
      timers.length = 0;
      lastPosRef.current = null;
      timers.push(window.setTimeout(tick, 2000));
    };
    window.addEventListener('archipelago:reset', onReset);

    // 机位 slider 改动时，实时更新在场椭圆的 ry（全场景统一机位，避免半压扁）
    const unsubTilt = subscribePondTilt(() => {
      if (!svg) return;
      const tilt = getPondTilt();
      for (const ch of Array.from(svg.children)) {
        const rx = Number(ch.getAttribute('data-rx'));
        if (rx) ch.setAttribute('ry', String(rx * tilt));
      }
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('click', onClick);
      window.removeEventListener('bg-ripple:spawn', onSpawn);
      window.removeEventListener('archipelago:reset', onReset);
      unsubTilt();
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
