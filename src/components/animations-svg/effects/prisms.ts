import type { AnimFn } from '../types';
import { TAU, CREAM, choice, makeEl, animate, ease } from '../helpers';

/** prisms — N 边形 + 顶点小圆，整体缩放扩散 */
export const prisms: AnimFn = ({ svg, w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  const sides = choice([3, 4, 5, 6]);
  const r = Math.min(w, h) * 0.05;
  const rot = Math.random() * TAU;

  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }

  const poly = makeEl('polygon', {
    points: pts.join(' '),
    fill: 'none',
    stroke: CREAM,
    'stroke-width': 0.8,
  });

  const dots: SVGCircleElement[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const d = makeEl<SVGCircleElement>('circle', {
      cx: cx + r * Math.cos(a),
      cy: cy + r * Math.sin(a),
      r: 3,
      fill: CREAM,
    });
    dots.push(d);
  }

  const g = makeEl('g', { 'transform-origin': `${cx} ${cy}` });
  g.appendChild(poly);
  dots.forEach((d) => g.appendChild(d));
  svg.appendChild(g);

  animate(750, (t) => {
    const e = ease.circIn(t);
    const s = e * 8;
    g.setAttribute('transform', `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`);
    g.setAttribute('opacity', String(1 - t * 0.6));
  }, () => g.remove());
};
