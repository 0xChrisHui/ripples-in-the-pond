import type { AnimFn } from '../types';
import { TAU, makeEl, animate, ease } from '../helpers';

/** timer — 圆环边缘指针扫一圈 */
export const timer: AnimFn = ({ svg, w, h, p }) => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;

  // 半透明背景圆环
  const ring = makeEl('circle', {
    cx, cy, r,
    fill: 'none',
    stroke: p.middleground,
    'stroke-width': 4,
    opacity: 0.35,
  });
  svg.appendChild(ring);

  // 指针 path（M 中心 L 边缘点）
  const path = makeEl('path', {
    d: `M ${cx} ${cy} L ${cx} ${cy - r}`,
    fill: 'none',
    stroke: p.foreground,
    'stroke-width': 6,
    'stroke-linecap': 'round',
  });
  svg.appendChild(path);

  animate(620, (t) => {
    const e = ease.cubicOut(t);
    const angle = e * TAU - Math.PI / 2;
    const ex = cx + r * Math.cos(angle);
    const ey = cy + r * Math.sin(angle);
    path.setAttribute('d', `M ${cx} ${cy} L ${ex} ${ey}`);
  }, () => {
    animate(220, (t) => {
      const op = String(1 - t);
      path.setAttribute('opacity', op);
      ring.setAttribute('opacity', String(0.35 * (1 - t)));
    }, () => {
      path.remove();
      ring.remove();
    });
  });
};
