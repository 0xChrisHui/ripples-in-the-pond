import type { AnimFn } from '../types';
import { CREAM, makeEl, animate } from '../helpers';

/** flashes — 全屏色矩形闪现（瞬时显示后淡出）
 *  variant 0/1/2 → 米黄 / 白 / accent 三色（对齐 patatap 原 i=0/1/2）
 */
export const flashes: AnimFn = ({ svg, w, h, p, variant = 0 }) => {
  const fills = [CREAM, p.white, p.accent];
  const fill = fills[variant % 3];

  const rect = makeEl('rect', {
    x: 0, y: 0, width: w, height: h, fill,
  });
  svg.appendChild(rect);

  animate(150, (t) => {
    rect.setAttribute('opacity', String(1 - t));
  }, () => rect.remove());
};
