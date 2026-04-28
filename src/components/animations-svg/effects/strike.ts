import type { AnimFn } from '../types';
import { TAU, CREAM, rand, makeEl, animate, ease } from '../helpers';

/** strike — 一道粗线斜劈过屏幕（先画上，再擦除）*/
export const strike: AnimFn = ({ svg, w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  const dist = rand(h * 0.5, w * 0.6);
  const theta = Math.random() * TAU;
  const x1 = cx + dist * Math.cos(theta);
  const y1 = cy + dist * Math.sin(theta);
  const x2 = cx + dist * Math.cos(theta + Math.PI);
  const y2 = cy + dist * Math.sin(theta + Math.PI);
  const lw = Math.round(rand(3, 10));
  const line = makeEl('line', {
    x1, y1, x2: x1, y2: y1,
    stroke: CREAM,
    'stroke-width': lw,
    'stroke-linecap': 'round',
  });
  svg.appendChild(line);

  animate(180, (t) => {
    const e = ease.circIn(t);
    line.setAttribute('x2', String(x1 + (x2 - x1) * e));
    line.setAttribute('y2', String(y1 + (y2 - y1) * e));
  }, () => {
    animate(450, (t) => {
      const e = ease.circOut(t);
      line.setAttribute('x1', String(x1 + (x2 - x1) * e));
      line.setAttribute('y1', String(y1 + (y2 - y1) * e));
    }, () => line.remove());
  });
};
