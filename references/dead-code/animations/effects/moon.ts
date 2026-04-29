/**
 * Phase 6 B2 — moon 动画（移植 references/patatap/src/animations/moon.js）
 *
 * 视觉：64 顶点的闭合路径，初始为水平线（y=Math.abs(y)），
 * 先把下半部往下推（变成凸弧），再把上半部往上推（变圆），最后复位重置。
 * 键位：e（patatap hash 0,2）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 64;
const HALF = AMOUNT / 2;

export const createMoon: EffectFactory = (stage): AnimationEffect => {
  const destinations = range(AMOUNT).map(() => new Two.Vector());
  const points = range(AMOUNT).map(() => new Two.Anchor());

  const moon = stage.makePath(points);
  moon.fill = palette.colors.foreground;
  moon.noStroke();

  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  const options = { in: 0, out: 0 };
  let playing = false;

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    options.in = 0;
    options.out = 0;

    moon.visible = false;
    moon.translation.set(stage.width / 2, stage.height / 2);
    moon.rotation = Math.random() * TWO_PI;

    const min = Math.min(stage.width, stage.height);
    const radius = min * 0.33;

    moon.vertices.forEach((v, i) => {
      const pct = i / (AMOUNT - 1);
      const theta = pct * TWO_PI;
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);
      destinations[i].set(x, y);
      if (i < HALF) {
        destinations[i].y *= -1;
      }
      v.set(x, Math.abs(y));
    });

    animateIn = new TWEEN.Tween(options)
      .to({ in: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onUpdate(() => {
        for (let i = HALF; i < AMOUNT; i++) {
          points[i].lerp(destinations[i], options.in);
        }
      })
      .onComplete(() => {
        if (animateOut) animateOut.start();
      });

    animateOut = new TWEEN.Tween(options)
      .to({ out: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onUpdate(() => {
        for (let i = 0; i < HALF; i++) {
          points[i].lerp(destinations[i], options.out);
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
    key: 'e',
    name: 'moon',
    start: () => {
      if (playing) return;
      playing = true;
      moon.visible = true;
      moon.fill = palette.colors.foreground;
      if (animateIn) animateIn.start();
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
