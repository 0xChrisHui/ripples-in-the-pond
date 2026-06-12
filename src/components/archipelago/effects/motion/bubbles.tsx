'use client';

import { useEffect, useRef } from 'react';
import { getPlaySpherePos } from '../../hooks/pond/use-play-sphere-pos';

/**
 * Phase 8-F F2 — bubbles 气泡升腾（Lane D 音频线）。
 *
 * 播放中每 3-6s 在播放球附近 spawn 1-2 个 r1-2px 纯圆光点：自下而上漂 20-40px +
 * 正弦横摆 + 到位淡出，同屏 ≤4，纯 transform/opacity。抽象铁律：只圆光斑，禁具象。
 *
 * 自挂 fixed overlay（不进 SphereCanvas/sim，避开 Lane A/E）；播放球屏幕坐标读
 * use-play-sphere-pos store（由 render-eclipse-moon 广播）。
 */

const MAX_ON_SCREEN = 4;

interface Props {
  playing: boolean;
}

export default function Bubbles({ playing }: Props) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    const layer = layerRef.current;
    if (!layer) return;
    let cancelled = false;
    const timers: number[] = [];

    const spawnOne = () => {
      const pos = getPlaySpherePos();
      if (!pos.visible || layer.children.length >= MAX_ON_SCREEN) return;
      const r = 1 + Math.random() * 1; // 1-2px
      const rise = 20 + Math.random() * 20; // 20-40px
      const sway = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8);
      const x = pos.x + (Math.random() - 0.5) * pos.r * 1.4;
      const y = pos.y + pos.r * 0.5; // 从球下缘起
      const dot = document.createElement('div');
      dot.className = 'pond-bubble';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.width = `${r * 2}px`;
      dot.style.height = `${r * 2}px`;
      dot.style.setProperty('--bub-rise', `${-rise}px`);
      dot.style.setProperty('--bub-sway', `${sway}px`);
      dot.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
      layer.appendChild(dot);
      const rm = window.setTimeout(() => { dot.remove(); }, 4200);
      timers.push(rm);
    };

    const tick = () => {
      if (cancelled) return;
      if (!document.hidden) {
        const n = 1 + (Math.random() < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) timers.push(window.setTimeout(spawnOne, i * 220));
      }
      timers.push(window.setTimeout(tick, 3000 + Math.random() * 3000));
    };
    timers.push(window.setTimeout(tick, 800));

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      while (layer.firstChild) layer.removeChild(layer.firstChild);
    };
  }, [playing]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
