import type { AnimFn } from '../types';
import { rand, makeEl, animate, ease } from '../helpers';

/** ufo — 椭圆从一侧滑到另一侧（带短暂淡入淡出）*/
export const ufo: AnimFn = ({ svg, w, h, p }) => {
  const fromLeft = Math.random() > 0.5;
  const cy = rand(h * 0.2, h * 0.8);
  const rx = w * 0.08;
  const ry = h * 0.025;
  const startX = fromLeft ? -rx * 2 : w + rx * 2;
  const endX = fromLeft ? w + rx * 2 : -rx * 2;

  const e = makeEl<SVGEllipseElement>('ellipse', {
    cx: startX,
    cy,
    rx,
    ry,
    fill: p.accent,
    opacity: 0,
  });
  svg.appendChild(e);

  animate(700, (t) => {
    const eased = ease.sineInOut(t);
    e.setAttribute('cx', String(startX + (endX - startX) * eased));
    // 两端淡入淡出
    let op = 0.85;
    if (t < 0.15) op = 0.85 * (t / 0.15);
    else if (t > 0.85) op = 0.85 * ((1 - t) / 0.15);
    e.setAttribute('opacity', String(op));
  }, () => e.remove());
};
