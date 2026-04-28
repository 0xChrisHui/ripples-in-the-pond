import type { AnimFn } from '../types';
import { TAU, CREAM, makeEl, animate } from '../helpers';

/** bubbles — 圆周一个个亮起的小点 */
export const bubbles: AnimFn = ({ svg, w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 3;
  const bubbleR = Math.min(w, h) / 90;
  const amount = 24;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const rot = Math.random() * TAU;
  const g = makeEl('g', {
    transform: `translate(${cx} ${cy}) rotate(${(rot * 180) / Math.PI})`,
  });
  svg.appendChild(g);

  const circles: SVGCircleElement[] = [];
  for (let i = 0; i < amount; i++) {
    const c = makeEl<SVGCircleElement>('circle', {
      cx: radius, cy: 0, r: bubbleR,
      fill: CREAM, opacity: 0,
    });
    g.appendChild(c);
    circles.push(c);
  }

  let i = 0;
  const stepDur = 28;
  const interval = setInterval(() => {
    if (i >= amount) {
      clearInterval(interval);
      animate(280, (t) => {
        circles.forEach((c) => c.setAttribute('opacity', String(1 - t)));
      }, () => g.remove());
      return;
    }
    const a = (i / amount) * TAU * direction;
    circles[i].setAttribute('cx', String(radius * Math.cos(a)));
    circles[i].setAttribute('cy', String(radius * Math.sin(a)));
    circles[i].setAttribute('opacity', '1');
    i++;
  }, stepDur);
};
