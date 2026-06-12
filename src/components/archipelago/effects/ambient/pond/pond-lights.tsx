'use client';

import { useEffect, useRef } from 'react';
import { MOON_ANCHOR } from '../../../render/render-helpers';

/**
 * 浮光 + 水面碎光 (P8-B §2.8 pondLights) — stars 的水塘替身。
 *
 * ~14 个浮光光点（少而大，缓慢游走 + 呼吸明灭，fill var(--pond-accent)，纯抽象不做萤火虫具象）
 * + ~24 条水面碎光短横线（聚在 MOON_ANCHOR 派生的上 1/3"月光带"，原地闪烁，fill var(--pond-glow)）。
 *
 * 亮度封顶纪律（§0/p8-s1 §三）：浮光/碎光峰值 opacity 低于球高光（暗水面最亮只许是球和月光）。
 * 性能：38 个元素 < 现 80 颗星；动画全 opacity/transform。生灭节奏仅对碎光（浮光数量恒定）。
 * document.hidden 跳过（抄 stars-background）。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const FLOAT_COUNT = 14;
const SHARD_COUNT = 24;
const TICK_MS = 1000;
const SPAWN_PROB = 0.3;
const DESPAWN_PROB = 0.3;
const FADE_MS = 1500;
// 月光带 y 范围（viewBox 100 制）：由 MOON_ANCHOR.y 派生——月在画面上方（y<0），
// 水面反射带落在视口顶部。锚点越靠上，反射带越贴顶；带宽固定 ~27 单位（上 1/3）。
const BAND_TOP = Math.max(0, 8 + MOON_ANCHOR.y * 80); // MOON_ANCHOR.y=-0.1 → top≈0..8
const BAND_BOTTOM = BAND_TOP + 27;

/** 浮光：r 0.25-0.4 大光点，专属游走 keyframe（4 随机途经点）+ 呼吸 */
function makeFloat(svg: SVGSVGElement, styleEl: HTMLStyleElement, i: number): SVGCircleElement {
  const el = document.createElementNS(SVG_NS, 'circle');
  const cx = Math.random() * 100;
  const cy = Math.random() * 100;
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('r', String(0.25 + Math.random() * 0.15));
  el.setAttribute('fill', 'var(--pond-accent)');
  // 外层游走：4 个随机途经点写成专属 keyframe，translate 序列（viewBox 单位 = px）
  const pts = Array.from({ length: 4 }, () => ({
    dx: (Math.random() - 0.5) * 24,
    dy: (Math.random() - 0.5) * 24,
  }));
  const frames = pts
    .map((p, k) => `${Math.round((k / pts.length) * 100)}% { transform: translate(${p.dx}px, ${p.dy}px); }`)
    .join('\n');
  styleEl.textContent += `@keyframes fl-${i} { ${frames} 100% { transform: translate(${pts[0].dx}px, ${pts[0].dy}px); } }\n`;
  el.style.transformBox = 'fill-box';
  el.style.transformOrigin = 'center';
  el.style.animation = `fl-${i} ${40 + Math.random() * 30}s ease-in-out infinite alternate, pl-breathe ${1.5 + Math.random() * 1.5}s ease-in-out infinite`;
  el.style.animationDelay = `0s, -${Math.random() * 3}s`;
  svg.appendChild(el);
  return el;
}

/** 碎光：短横线 rect，聚月光带，原地 opacity 闪烁（无位移） */
function makeShard(): SVGRectElement {
  const el = document.createElementNS(SVG_NS, 'rect');
  const w = 1.2 + Math.random() * 1.8;
  el.setAttribute('x', String(Math.random() * 100));
  el.setAttribute('y', String(BAND_TOP + Math.random() * (BAND_BOTTOM - BAND_TOP)));
  el.setAttribute('width', String(w));
  el.setAttribute('height', '0.18');
  el.setAttribute('rx', '0.09');
  el.setAttribute('fill', 'var(--pond-glow)');
  el.style.animation = `pl-shard ${2 + Math.random() * 2}s ease-in-out infinite`;
  el.style.animationDelay = `-${Math.random() * 3}s`;
  return el;
}

export default function PondLights() {
  const floatRef = useRef<SVGSVGElement>(null);
  const shardRef = useRef<SVGSVGElement>(null);
  const styleRef = useRef<HTMLStyleElement>(null);

  useEffect(() => {
    const floatSvg = floatRef.current;
    const shardSvg = shardRef.current;
    const styleEl = styleRef.current;
    if (!floatSvg || !shardSvg || !styleEl) return;
    let cancelled = false;
    const fadeTimers: number[] = [];

    while (floatSvg.firstChild) floatSvg.removeChild(floatSvg.firstChild);
    while (shardSvg.firstChild) shardSvg.removeChild(shardSvg.firstChild);
    styleEl.textContent = '';
    for (let i = 0; i < FLOAT_COUNT; i++) makeFloat(floatSvg, styleEl, i);
    for (let i = 0; i < SHARD_COUNT; i++) shardSvg.appendChild(makeShard());

    // 生灭仅对碎光（浮光恒定）：抄 stars 的 1s tick + 30% spawn/despawn
    const interval = window.setInterval(() => {
      if (cancelled || document.hidden) return;
      if (Math.random() < SPAWN_PROB) {
        const s = makeShard();
        s.style.opacity = '0';
        s.style.transition = `opacity ${FADE_MS}ms ease`;
        shardSvg.appendChild(s);
        requestAnimationFrame(() => { s.style.opacity = '1'; });
      }
      if (Math.random() < DESPAWN_PROB && shardSvg.children.length > SHARD_COUNT * 0.5) {
        const idx = Math.floor(Math.random() * shardSvg.children.length);
        const target = shardSvg.children[idx] as SVGElement;
        target.style.transition = `opacity ${FADE_MS}ms ease`;
        target.style.opacity = '0';
        const id = window.setTimeout(() => { if (target.parentNode) target.remove(); }, FADE_MS + 50);
        fadeTimers.push(id);
      }
    }, TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      fadeTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // 静态 keyframes（pl-breathe / pl-shard）在 app/pond-effects.css「Lane B」区块；
  // 浮光游走 keyframe fl-{i} 为每实例动态生成，留在 styleRef inline。
  return (
    <>
      <style ref={styleRef} />
      <svg ref={floatRef} className="pointer-events-none fixed inset-0 z-0" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" />
      <svg ref={shardRef} className="pointer-events-none fixed inset-0 z-0" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" />
    </>
  );
}
