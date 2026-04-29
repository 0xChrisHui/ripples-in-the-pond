/**
 * Phase 6 B2 — strike 动画（移植 references/patatap/src/animations/strike.js）
 *
 * 视觉：一根线随机角度划过中心点，先从一端伸到另一端，再从起点收回。
 * 键位：h
 */
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, map } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

export const createStrike: EffectFactory = (stage): AnimationEffect => {
  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  const line = stage.makeLine(0, 0, 0, 0);
  line.stroke = palette.colors.black;
  line.cap = 'round';
  line.noFill();
  line.visible = false;

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    const n = Math.random();
    const distance = Math.round(map(n, 0, 1, stage.height * 0.5, stage.width));

    let theta = Math.random() * TWO_PI;
    line.vertices[0].set(distance * Math.cos(theta), distance * Math.sin(theta));
    theta += Math.PI;
    line.vertices[1].set(distance * Math.cos(theta), distance * Math.sin(theta));

    line.linewidth = Math.round(n * 7) + 3;
    line.ending = 0;
    line.beginning = 0;
    line.visible = false;
    line.translation.set(stage.width / 2, stage.height / 2);

    animateIn = new TWEEN.Tween(line)
      .to({ ending: 1 }, DURATION * 0.1)
      .easing(TWEEN.Easing.Circular.In)
      .onComplete(() => animateOut?.start());

    animateOut = new TWEEN.Tween(line)
      .to({ beginning: 1 }, DURATION * 0.35)
      .easing(TWEEN.Easing.Circular.Out)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 'h',
    name: 'strike',
    start: () => {
      if (playing) return;
      playing = true;
      line.stroke = palette.colors.black;
      line.visible = true;
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
