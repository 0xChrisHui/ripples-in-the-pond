import type { AnimFn } from '../types';
import { TAU, CREAM, rand, makeEl, animate, ease } from '../helpers';

/** suspension — 16 圆点束朝某随机方向射散 */
export const suspension: AnimFn = ({ svg, w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  const count = 16;
  const baseAngle = Math.random() * TAU;
  const dev = Math.PI / 4;

  interface Dot {
    c: SVGCircleElement;
    tx: number;
    ty: number;
  }
  const dots: Dot[] = [];
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (Math.random() - 0.5) * dev;
    const dist = rand(80, Math.min(w, h) * 0.5);
    const tx = dist * Math.cos(angle);
    const ty = dist * Math.sin(angle);
    const r = rand(4, 14);
    const c = makeEl<SVGCircleElement>('circle', {
      cx, cy, r,
      fill: CREAM,
      opacity: 0,
    });
    svg.appendChild(c);
    dots.push({ c, tx, ty });
  }

  animate(750, (t) => {
    const e = ease.sineOut(t);
    const fadeIn = Math.min(1, t * 5);
    const fadeOut = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
    const op = String(fadeIn * fadeOut);
    dots.forEach((d) => {
      d.c.setAttribute('cx', String(cx + d.tx * e));
      d.c.setAttribute('cy', String(cy + d.ty * e));
      d.c.setAttribute('opacity', op);
    });
  }, () => dots.forEach((d) => d.c.remove()));
};
