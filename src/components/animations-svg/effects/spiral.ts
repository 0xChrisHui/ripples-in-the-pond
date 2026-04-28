import type { AnimFn } from '../types';
import { TAU, makeEl, animate, ease } from '../helpers';

/** spiral — 对数螺旋 120 条线从中心一个个亮起 */
export const spiral: AnimFn = ({ svg, w, h, p }) => {
  const cx = w / 2;
  const cy = h / 2;
  const count = 120;
  const maxR = Math.min(w, h) * 0.45;
  const turns = 4;
  const direction = Math.random() > 0.5 ? 1 : -1;

  const g = makeEl('g', { transform: `translate(${cx} ${cy})` });
  svg.appendChild(g);

  const lines: SVGLineElement[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const angle = direction * t * TAU * turns;
    const r2 = maxR * Math.pow(t, 0.7);
    const r1 = Math.max(0, r2 - 10);
    const x1 = r1 * Math.cos(angle);
    const y1 = r1 * Math.sin(angle);
    const x2 = r2 * Math.cos(angle);
    const y2 = r2 * Math.sin(angle);
    const line = makeEl<SVGLineElement>('line', {
      x1, y1, x2, y2,
      stroke: p.foreground,
      'stroke-width': 1.4,
      'stroke-linecap': 'round',
      opacity: 0,
    });
    g.appendChild(line);
    lines.push(line);
  }

  let i = 0;
  const stepDur = 5;
  const interval = setInterval(() => {
    if (i >= count) {
      clearInterval(interval);
      animate(420, (t) => {
        const e = ease.sineOut(t);
        lines.forEach((l) => l.setAttribute('opacity', String(1 - e)));
      }, () => g.remove());
      return;
    }
    lines[i].setAttribute('opacity', '1');
    i++;
  }, stepDur);
};
