/**
 * Phase 6 B2 — suspension 动画（移植 references/patatap/src/animations/suspension.js）
 *
 * 视觉：16 个小白圆从中心同时沿一束随机方向（同 theta ± deviation）飞出。
 * 用 Tween 一个 ending 0→1 驱动 group 内每个 circle 的 translation.lerp。
 * 键位：y（patatap hash 0,5）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range, map } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 16;

export const createSuspension: EffectFactory = (stage): AnimationEffect => {
  const min = Math.min(stage.width, stage.height);
  const r1 = (min * 12) / 900;
  const r2 = (min * 20) / 900;

  // 注：Two.Circle 0.8.x 实例只有 width/height（同 Polygon）；用 scale 调大小
  // 这里 radius 直接传给构造函数 Two.Circle(x, y, radius) 是支持的；
  // 但每次 reset 不会变 radius，构造一次即可
  const circles = range(AMOUNT).map(() => {
    const r = Math.round(map(Math.random(), 0, 1, r1, r2));
    const c = new Two.Circle(0, 0, r);
    c.fill = palette.colors.white;
    c.noStroke();
    return c;
  });

  const destinations = range(AMOUNT).map(() => new Two.Vector());

  const group = stage.makeGroup(circles);
  group.visible = false;
  group.translation.set(stage.width / 2, stage.height / 2);

  const options = { ending: 0 };
  let animateIn: TWEEN.Tween | null = null;
  let playing = false;

  function buildTweens(): void {
    if (animateIn) animateIn.stop();

    group.translation.set(stage.width / 2, stage.height / 2);
    group.visible = false;

    const distance = stage.height;
    const theta = Math.random() * TWO_PI;
    const deviation = map(Math.random(), 0, 1, Math.PI / 4, Math.PI / 2);

    options.ending = 0;

    for (let i = 0; i < AMOUNT; i++) {
      const t = theta + (2 * Math.random() - 1) * deviation;
      const a = Math.random() * distance;
      destinations[i].set(a * Math.cos(t), a * Math.sin(t));
      circles[i].translation.set(0, 0);
    }

    animateIn = new TWEEN.Tween(options)
      .to({ ending: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onUpdate(({ ending }) => {
        for (let i = 0; i < AMOUNT; i++) {
          circles[i].translation.lerp(destinations[i], ending);
        }
      })
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 'y',
    name: 'suspension',
    start: () => {
      if (playing) return;
      playing = true;
      group.fill = palette.colors.white;
      group.visible = true;
      animateIn?.start();
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
