/**
 * Phase 6 B2 — corona 动画（移植 references/patatap/src/animations/corona.js）
 *
 * 视觉：32 个三角形小图形从某点开始沿圆周一个个出现 → 全部出现后逆向消失。
 * 键位：B（patatap hash 2,4 = 第 3 排第 5 列 = b）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 32;
const LAST = AMOUNT - 1;

export const createCorona: EffectFactory = (stage): AnimationEffect => {
  const animateIns: TWEEN.Tween[] = [];
  const animateOuts: TWEEN.Tween[] = [];

  let direction = true;
  let playing = false;

  // 注：Two.js 0.8.x Polygon 用 width/height（构造 radius 转 width=2r/height=2r）
  // 初始 radius=1（不要 0），后面用 scale 缩到 bubbleRadius
  const circles = range(AMOUNT).map(() => {
    const c = new Two.Polygon(0, 0, 1, 3);
    return c;
  });

  // 给每个 polygon 挂 theta/destination 动态属性
  // 注：Two 是类不是 namespace，type 用 InstanceType 解
  type CircleX = InstanceType<typeof Two.Polygon> & { theta: number; destination: number };
  circles.forEach((c) => {
    (c as CircleX).theta = 0;
    (c as CircleX).destination = 0;
  });

  const group = stage.makeGroup(circles);
  group.noStroke();
  group.fill = palette.colors.white;

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
    const radius = min * 0.45;
    const bubbleRadius = stage.height * 1.2 / 90;
    const offset = -Math.PI / 6;

    for (let i = 0; i < AMOUNT; i++) {
      const pct = i / AMOUNT;
      const npt = (i + 1) / AMOUNT;

      const c = circles[i] as CircleX;
      c.visible = false;
      // Two.Polygon 没有 radius 属性—用 scale 代替（Polygon 默认 radius=0，scale 拉到目标）
      c.scale = bubbleRadius;
      c.destination = TWO_PI * pct;
      c.theta = 0;
      c.translation.set(radius, 0);

      const ain = new TWEEN.Tween(c)
        .to({ theta: c.destination }, 0.1 * DURATION / (i + 1))
        .onStart(() => { c.visible = true; })
        .onUpdate(() => {
          const theta = c.theta * (direction ? 1 : -1);
          c.translation.set(radius * Math.cos(theta), radius * Math.sin(theta));
          c.rotation = theta + offset;
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
        .to({ theta: dest }, 0.1 * DURATION / (AMOUNT - (i + 1)))
        .onUpdate(() => {
          const theta = c.theta * (direction ? 1 : -1);
          c.translation.set(radius * Math.cos(theta), radius * Math.sin(theta));
          c.rotation = theta + offset;
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
    key: 'b',
    name: 'corona',
    start: () => {
      if (playing) return;
      playing = true;
      group.fill = palette.colors.white;
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
