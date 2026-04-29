/**
 * Phase 6 B2 — bubbles 动画（移植 references/patatap/src/animations/bubbles.js）
 *
 * 视觉：24 个小圆点沿圆周一个个出现 → 全部出现后逆向消失。
 * 与 corona 类似但形状是圆 + 不带 rotation/offset + radius=min/3 而非 0.45*min。
 * 键位：g（patatap hash 1,4）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 24;
const LAST = AMOUNT - 1;

export const createBubbles: EffectFactory = (stage): AnimationEffect => {
  const animateIns: TWEEN.Tween[] = [];
  const animateOuts: TWEEN.Tween[] = [];

  let direction = true;
  let playing = false;

  // Polygon(0,0,1,30) 当圆形（30 边足够圆滑）；用 scale 缩到目标 radius
  const circles = range(AMOUNT).map(() => new Two.Polygon(0, 0, 1, 30));

  type CircleX = InstanceType<typeof Two.Polygon> & { theta: number; destination: number };
  circles.forEach((c) => {
    (c as CircleX).theta = 0;
    (c as CircleX).destination = 0;
  });

  const group = stage.makeGroup(circles);
  group.noStroke();
  group.fill = palette.colors.black;

  function buildTweens(): void {
    if (animateIns.length > 0) {
      animateIns.forEach((t) => t.stop());
      animateIns.length = 0;
    }
    if (animateOuts.length > 0) {
      animateOuts.forEach((t) => t.stop());
      animateOuts.length = 0;
    }

    direction = Math.random() > 0.5;
    group.rotation = Math.random() * TWO_PI;
    group.translation.set(stage.width / 2, stage.height / 2);

    const min = Math.min(stage.width, stage.height);
    const radius = min / 3;
    const bubbleRadius = min / 90;

    for (let i = 0; i < AMOUNT; i++) {
      const pct = i / AMOUNT;
      const npt = (i + 1) / AMOUNT;

      const c = circles[i] as CircleX;
      c.visible = false;
      c.scale = bubbleRadius;
      c.destination = TWO_PI * pct;
      c.theta = 0;
      c.translation.set(radius, 0);

      const ain = new TWEEN.Tween(c)
        .to({ theta: c.destination }, 0.2 * DURATION / (i + 1))
        .onStart(() => { c.visible = true; })
        .onUpdate(() => {
          const theta = c.theta * (direction ? 1 : -1);
          c.translation.set(radius * Math.cos(theta), radius * Math.sin(theta));
        })
        .onComplete(() => {
          if (i >= LAST) {
            animateOuts[0].start();
            return;
          }
          const next = circles[i + 1] as CircleX;
          next.theta = c.theta;
          next.translation.copy(c.translation);
          animateIns[i + 1].start();
        });
      animateIns.push(ain);

      const dest = Math.min(npt * TWO_PI, TWO_PI);
      const aout = new TWEEN.Tween(c)
        .to({ theta: dest }, 0.2 * DURATION / (AMOUNT - (i + 1)))
        .onUpdate(() => {
          const theta = c.theta * (direction ? 1 : -1);
          c.translation.set(radius * Math.cos(theta), radius * Math.sin(theta));
        })
        .onComplete(() => {
          c.visible = false;
          if (i >= LAST - 1) {
            playing = false;
            buildTweens();
          } else {
            animateOuts[i + 1].start();
          }
        });
      animateOuts.push(aout);
    }
  }

  buildTweens();

  return {
    key: 'g',
    name: 'bubbles',
    start: () => {
      if (playing) return;
      playing = true;
      group.fill = palette.colors.black;
      animateIns[0].start();
    },
    reset: () => {
      playing = false;
      buildTweens();
    },
    onResize: () => {
      buildTweens();
    },
  };
};
