import type { AnimFn } from '../types';
import { TAU, CREAM, choice, makeEl, animate, ease } from '../helpers';

/** zigzag — 锯齿闪电折线，先描出再擦除 */
export const zigzag: AnimFn = ({ svg, w, h }) => {
  const fromLeft = Math.random() > 0.5;
  const cx = fromLeft ? w * 0.15 : w * 0.85;
  const cy = h / 2;
  const phi = choice([2, 3, 4, 5]);
  const width = w / 16;
  const height = h * 0.66;
  const amount = 80;
  const rotate = Math.random() > 0.5 ? 180 : 0;

  const pts: [number, number][] = [];
  for (let i = 0; i < amount; i++) {
    const pct = i / amount;
    const triangle = Math.abs((((2 * (pct * TAU * phi + Math.PI / 2)) / Math.PI) - 1) % 4 - 2) - 1;
    const x = (triangle * width) / 2;
    const y = -height / 2 + pct * height;
    pts.push([x, y]);
  }

  const totalLen = pts.reduce((acc, pt, idx) =>
    idx === 0 ? 0 : acc + Math.hypot(pt[0] - pts[idx - 1][0], pt[1] - pts[idx - 1][1]),
    0,
  );
  const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ');

  const path = makeEl('path', {
    d,
    fill: 'none',
    stroke: CREAM,
    'stroke-width': Math.min(w, h) / 30,
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'miter',
    transform: `translate(${cx} ${cy}) rotate(${rotate})`,
    'stroke-dasharray': `${totalLen} ${totalLen}`,
    'stroke-dashoffset': totalLen,
  });
  svg.appendChild(path);

  animate(220, (t) => {
    const e = ease.sineOut(t);
    path.setAttribute('stroke-dashoffset', String(totalLen * (1 - e)));
  }, () => {
    animate(220, (t) => {
      const e = ease.sineOut(t);
      path.setAttribute('stroke-dasharray', `${totalLen * (1 - e)} ${totalLen * e + 0.1} ${totalLen * e}`);
    }, () => path.remove());
  });
};
