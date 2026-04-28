import type { AnimFn } from '../types';
import { makeEl, animate, ease } from '../helpers';

/** splits — 屏幕一分为二，上下两半向上下分离再隐去 */
export const splits: AnimFn = ({ svg, w, h, p }) => {
  const top = makeEl<SVGRectElement>('rect', {
    x: 0, y: 0, width: w, height: h / 2,
    fill: p.foreground, opacity: 0,
  });
  const bot = makeEl<SVGRectElement>('rect', {
    x: 0, y: h / 2, width: w, height: h / 2,
    fill: p.middleground, opacity: 0,
  });
  svg.appendChild(top);
  svg.appendChild(bot);

  // Phase 1：闪现
  animate(80, (t) => {
    top.setAttribute('opacity', String(t));
    bot.setAttribute('opacity', String(t));
  }, () => {
    // Phase 2：上下分离 + 渐隐
    animate(500, (t) => {
      const e = ease.expoOut(t);
      top.setAttribute('y', String(-e * (h / 2)));
      bot.setAttribute('y', String(h / 2 + e * (h / 2)));
      const op = String(1 - t);
      top.setAttribute('opacity', op);
      bot.setAttribute('opacity', op);
    }, () => {
      top.remove();
      bot.remove();
    });
  });
};
