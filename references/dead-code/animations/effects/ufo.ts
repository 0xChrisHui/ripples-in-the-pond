/**
 * Phase 6 B2 — ufo 动画（移植 references/patatap/src/animations/ufo.js）
 *
 * 视觉：一个大圆从画面左/右上/下方飞到画面中线，然后缩成 0 消失。
 * 键位：d
 */
import * as TWEEN from '@tweenjs/tween.js';
import { DURATION } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

export const createUfo: EffectFactory = (stage): AnimationEffect => {
  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  const minDim = () => Math.min(stage.width, stage.height);

  const circle = stage.makeCircle(0, 0, minDim() * 0.25);
  circle.noStroke();
  circle.fill = palette.colors.accent;
  circle.visible = false;

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    const isRight = Math.random() > 0.5;
    const isTop = Math.random() > 0.5;

    circle.translation.x = stage.width * (isRight ? 0.75 : 0.25);
    circle.translation.y = stage.height * (isTop ? -0.5 : 1.5);
    circle.scale = 1;
    circle.visible = false;

    animateIn = new TWEEN.Tween(circle.translation)
      .to({ y: stage.height / 2 }, DURATION / 2)
      .easing(TWEEN.Easing.Circular.Out)
      .onComplete(() => animateOut?.start());

    animateOut = new TWEEN.Tween(circle)
      .to({ scale: 0 }, DURATION / 2)
      .easing(TWEEN.Easing.Circular.Out)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 'd',
    name: 'ufo',
    start: () => {
      if (playing) return;
      playing = true;
      circle.fill = palette.colors.accent;
      circle.visible = true;
      animateIn?.start();
    },
    reset: () => {
      playing = false;
      buildTweens();
    },
    onResize: () => {
      // Two.js Circle 0.8.x 没有 radius 属性 → 重建
      buildTweens();
    },
  };
};
