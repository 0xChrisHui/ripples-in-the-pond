import type { AnimFn } from '../types';
import { rand, makeEl } from '../helpers';

/** glimmer — 满屏小亮点闪烁（星空感）*/
export const glimmer: AnimFn = ({ svg, w, h, p }) => {
  const count = 80;
  const dots: { c: SVGCircleElement; phase: number }[] = [];

  for (let i = 0; i < count; i++) {
    const c = makeEl<SVGCircleElement>('circle', {
      cx: Math.random() * w,
      cy: Math.random() * h,
      r: rand(1.5, 3.5),
      fill: p.highlight,
      opacity: 0,
    });
    svg.appendChild(c);
    dots.push({ c, phase: Math.random() * Math.PI * 2 });
  }

  const start = performance.now();
  const dur = 900;
  let raf = 0;
  const tick = (now: number) => {
    const t = (now - start) / dur;
    if (t >= 1) {
      dots.forEach((d) => d.c.remove());
      return;
    }
    const envelope = Math.sin(t * Math.PI);
    dots.forEach((d) => {
      const v = 0.5 + 0.5 * Math.sin(d.phase + t * 12);
      d.c.setAttribute('opacity', String(envelope * v));
    });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  void raf;
};
