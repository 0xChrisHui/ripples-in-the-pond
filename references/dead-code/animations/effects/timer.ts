/**
 * Phase 6 B2 — timer 动画（移植 references/patatap/src/animations/timer.js）
 *
 * 视觉：一个空心圆从某角度开始描画一圈再从头消失（类似计时器圆环）。
 * 键位：t
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

export const createTimer: EffectFactory = (stage): AnimationEffect => {
  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  const minDim = () => Math.min(stage.width, stage.height);

  // Two.js 0.8.x: makeCircle(x, y, radius) — radius 仅构造时设
  const timer = stage.makeCircle(0, 0, minDim() / 3);
  timer.stroke = palette.colors.highlight;
  timer.closed = false;
  timer.cap = 'butt';
  timer.noFill();
  timer.linewidth = minDim() / 10;
  timer.scale = new Two.Vector(1, 1);
  timer.visible = false;

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    timer.translation.set(stage.width / 2, stage.height / 2);
    timer.visible = false;
    timer.rotation = TWO_PI * Math.random();
    timer.beginning = 0;
    timer.ending = 0;

    if (Math.random() > 0.5) {
      const sc = timer.scale as InstanceType<typeof Two.Vector>;
      sc.x *= -1;
    }

    animateIn = new TWEEN.Tween(timer)
      .to({ ending: 1 }, DURATION / 3)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onComplete(() => animateOut?.start());

    animateOut = new TWEEN.Tween(timer)
      .to({ beginning: 1 }, DURATION / 3)
      .easing(TWEEN.Easing.Sinusoidal.In)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 't',
    name: 'timer',
    start: () => {
      if (playing) return;
      playing = true;
      timer.stroke = palette.colors.highlight;
      timer.visible = true;
      animateIn?.start();
    },
    reset: () => {
      playing = false;
      buildTweens();
    },
    onResize: () => {
      timer.linewidth = minDim() / 10;
      buildTweens();
    },
  };
};
