/**
 * Phase 6 B2 — zigzag 动画（移植 references/patatap/src/animations/zigzag.js）
 *
 * 视觉：竖直三角波 path（120 顶点），靠 path.beginning / path.ending 做"画线 → 擦除"。
 * phi（波数）每次 reset 在 1/2/4/5 中随机；左右两侧 0.15/0.85 width 也随机。
 * 键位：l（patatap hash 1,8）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range, map } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 120;

export const createZigzag: EffectFactory = (stage): AnimationEffect => {
  const points = range(AMOUNT).map(() => new Two.Anchor());
  const zigzag = stage.makePath(points);
  zigzag.closed = false;
  zigzag.noFill();
  zigzag.stroke = palette.colors.black;
  zigzag.join = 'miter';
  zigzag.miter = 4;
  zigzag.cap = 'butt';
  zigzag.visible = false;

  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    const min = Math.min(stage.width, stage.height);
    zigzag.linewidth = min / 30;

    const offset = Math.PI / 2;
    const index = Math.random() * 4;
    let phi: number;
    if (index > 3) phi = 5;
    else if (index > 2) phi = 4;
    else if (index > 1) phi = 2;
    else phi = 1;

    zigzag.rotation = Math.random() > 0.5 ? Math.PI : 0;
    zigzag.visible = false;
    zigzag.beginning = 0;
    zigzag.ending = 0;

    const cy = stage.height / 2;
    if (Math.random() > 0.5) {
      zigzag.translation.set(stage.width * 0.85, cy);
    } else {
      zigzag.translation.set(stage.width * 0.15, cy);
    }

    const width = stage.width / 16;
    const height = stage.height * 0.66;

    for (let i = 0; i < zigzag.vertices.length; i++) {
      const v = zigzag.vertices[i];
      const pct = i / AMOUNT;
      // 三角波公式（与原 patatap 一致）
      const theta =
        Math.abs((((2 * (pct * TWO_PI * phi + offset)) / Math.PI - 1) % 4) - 2) - 1;
      const x = (theta * width) / 2;
      const y = map(pct, 0, 1, -height / 2, height / 2);
      v.set(x, y);
    }

    animateIn = new TWEEN.Tween(zigzag)
      .to({ ending: 1 }, DURATION * 0.25)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onComplete(() => {
        animateOut?.start();
      });

    animateOut = new TWEEN.Tween(zigzag)
      .to({ beginning: 1 }, DURATION * 0.25)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 'l',
    name: 'zigzag',
    start: () => {
      if (playing) return;
      playing = true;
      zigzag.visible = true;
      zigzag.stroke = palette.colors.black;
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
