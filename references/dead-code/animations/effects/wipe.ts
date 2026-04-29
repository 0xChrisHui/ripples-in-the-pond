/**
 * Phase 6 B2 — wipe 动画（移植 references/patatap/src/animations/wipe.js）
 *
 * 视觉：覆盖画面的矩形从左或右滑入到中央后，继续滑出。
 * 键位：x
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { DURATION } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

export const createWipe: EffectFactory = (stage): AnimationEffect => {
  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  const cx = () => stage.width / 2;
  const cy = () => stage.height / 2;

  const points = [
    new Two.Anchor(-cx(), -cy()),
    new Two.Anchor(cx(), -cy()),
    new Two.Anchor(cx(), cy()),
    new Two.Anchor(-cx(), cy()),
  ];
  const shape = stage.makePath(points);
  shape.closed = true;
  shape.fill = palette.colors.middleground;
  shape.noStroke();

  const destIn = { x: cx() };
  const destOut = { x: stage.width * 1.5 };

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    shape.visible = false;
    playing = false;

    if (Math.random() > 0.5) {
      shape.translation.set(-cx(), cy());
      destOut.x = stage.width * 1.5;
    } else {
      shape.translation.set(stage.width * 1.5, cy());
      destOut.x = -cx();
    }
    destIn.x = cx();

    animateIn = new TWEEN.Tween(shape.translation)
      .to(destIn, DURATION * 0.5)
      .easing(TWEEN.Easing.Exponential.Out)
      .onComplete(() => animateOut?.start());

    animateOut = new TWEEN.Tween(shape.translation)
      .to(destOut, DURATION * 0.5)
      .easing(TWEEN.Easing.Exponential.In)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });
  }

  function resizePoints(): void {
    points[0].set(-cx(), -cy());
    points[1].set(cx(), -cy());
    points[2].set(cx(), cy());
    points[3].set(-cx(), cy());
  }

  buildTweens();

  return {
    key: 'x',
    name: 'wipe',
    start: () => {
      if (playing) return;
      playing = true;
      shape.fill = palette.colors.middleground;
      shape.visible = true;
      animateIn?.start();
    },
    reset: () => {
      playing = false;
      buildTweens();
    },
    onResize: () => {
      resizePoints();
      buildTweens();
    },
  };
};
