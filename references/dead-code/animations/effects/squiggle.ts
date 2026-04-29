/**
 * Phase 6 B2 — squiggle 动画（移植 references/patatap/src/animations/squiggle.js）
 *
 * 视觉：横贯屏幕的正弦波，靠 path.beginning / path.ending 做"画线 → 擦除"。
 * phi（波数）每次 reset 随机 1-7。
 * 键位：i（patatap hash 0,7）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range, map } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 200;

export const createSquiggle: EffectFactory = (stage): AnimationEffect => {
  const points = range(AMOUNT).map(() => new Two.Anchor());
  const squiggle = stage.makePath(points);
  squiggle.closed = true;
  squiggle.noFill();
  squiggle.stroke = palette.colors.accent;
  squiggle.cap = 'round';
  squiggle.join = 'round';

  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    const min = Math.min(stage.width, stage.height);
    squiggle.linewidth = min / 40;
    squiggle.translation.set(stage.width / 2, stage.height / 2);

    const phi = Math.round(Math.random() * 6) + 1;
    const offset = Math.PI / 2;
    const width = stage.width / 2;
    const height = stage.height / 3;

    squiggle.rotation = Math.random() > 0.5 ? Math.PI : 0;
    squiggle.beginning = 0;
    squiggle.ending = 0;
    squiggle.visible = false;

    for (let i = 0; i < squiggle.vertices.length; i++) {
      const v = squiggle.vertices[i];
      const pct = i / AMOUNT;
      const theta = TWO_PI * phi * pct + offset;
      const x = map(pct, 0, 1, -width / 2, width / 2);
      const y = height * Math.sin(theta);
      v.set(x, y);
    }

    animateIn = new TWEEN.Tween(squiggle)
      .to({ ending: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onComplete(() => {
        if (animateOut) animateOut.start();
      });

    animateOut = new TWEEN.Tween(squiggle)
      .to({ beginning: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Sinusoidal.In)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 'i',
    name: 'squiggle',
    start: () => {
      if (playing) return;
      playing = true;
      squiggle.visible = true;
      squiggle.stroke = palette.colors.accent;
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
