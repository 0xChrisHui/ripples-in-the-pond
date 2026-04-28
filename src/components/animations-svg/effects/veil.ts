import type { AnimFn } from '../types';
import { makeEl, animate, ease } from '../helpers';

/** veil — 半透明色幕从顶部覆下再上移 */
export const veil: AnimFn = ({ svg, w, h, p }) => {
  const rect = makeEl<SVGRectElement>('rect', {
    x: 0, y: -h,
    width: w, height: h,
    fill: p.middleground,
    opacity: 0.7,
  });
  svg.appendChild(rect);

  // Phase 1：从顶部下降覆盖
  animate(380, (t) => {
    const e = ease.sineOut(t);
    rect.setAttribute('y', String(-h + h * e));
  }, () => {
    // Phase 2：再上移消失
    animate(380, (t) => {
      const e = ease.sineIn(t);
      rect.setAttribute('y', String(-h * e));
    }, () => rect.remove());
  });
};
