'use client';

import { useEffect, useRef } from 'react';

/**
 * 星空倒影 (P8-F F3 skyReflection) — 旧 stars 不是删除而是"倒进水里"。
 *
 * 12-20 个模糊光点（径向渐变模拟 blur），位置静态、各自极慢晃动 + 呼吸明灭。
 * 亮度封顶纪律（同 pondLights）：峰值 opacity 低于球高光（暗水面最亮只许是球和月光）。
 * 性能：全 opacity/transform 动画；mount 时一次性建好，无生灭循环。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const COUNT = 16; // 12-20

export default function SkyReflection() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    for (let i = 0; i < COUNT; i++) {
      const cx = Math.random() * 100;
      const cy = Math.random() * 100;
      const r = 0.6 + Math.random() * 1.2; // 模糊光点（viewBox 100 制）
      const g = document.createElementNS(SVG_NS, 'g');
      // 极慢晃动：1-3px 级（viewBox 100 制约 1-3 单位）
      const dx = (Math.random() - 0.5) * 4;
      const dy = (Math.random() - 0.5) * 4;
      g.style.setProperty('--skr-dx', `${dx}`);
      g.style.setProperty('--skr-dy', `${dy}`);
      g.style.transformBox = 'fill-box';
      g.style.transformOrigin = 'center';
      g.style.animation = `skyref-sway ${10 + Math.random() * 8}s ease-in-out infinite alternate`;
      g.style.animationDelay = `-${Math.random() * 10}s`;

      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(cx));
      c.setAttribute('cy', String(cy));
      c.setAttribute('r', String(r));
      c.setAttribute('fill', 'var(--pond-glow)');
      // 呼吸明灭：fill-opacity 0.06↔0.34（封顶低于球高光）
      c.style.animation = `skyref-breathe ${2.5 + Math.random() * 3}s ease-in-out infinite`;
      c.style.animationDelay = `-${Math.random() * 4}s`;
      g.appendChild(c);
      svg.appendChild(g);
    }
  }, []);

  // keyframes 在 app/pond-effects.css「Lane B」区块（skyref-breathe / skyref-sway）
  return (
    <>
      <svg
        ref={svgRef}
        className="pointer-events-none fixed inset-0 z-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ filter: 'blur(1.2px)' }}
      />
    </>
  );
}
