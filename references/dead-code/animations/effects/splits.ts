/**
 * Phase 6 B2 — splits 动画（移植 references/patatap/src/animations/splits.js）
 *
 * 视觉：两个半圆组成的圆形闪烁出现，随后上下分离 + 整体淡出。
 * 键位：c
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { DURATION, range } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const SEGMENTS = 25;

function makeSemiCircle(): InstanceType<typeof Two.Path> {
  const points = range(SEGMENTS).map((i) => {
    const pct = i / (SEGMENTS - 1);
    const theta = pct * Math.PI;
    return new Two.Anchor(Math.cos(theta), Math.sin(theta));
  });
  const path = new Two.Path(points);
  path.fill = palette.colors.foreground;
  path.stroke = palette.colors.foreground;
  path.closed = true;
  return path;
}

export const createSplits: EffectFactory = (stage): AnimationEffect => {
  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  const a = makeSemiCircle();
  const b = makeSemiCircle();
  const group = stage.makeGroup(a, b);
  b.rotation = Math.PI;

  const options = { in: 0, out: 0 };

  function applyResize(): void {
    const min = Math.min(stage.width, stage.height);
    group.scale = min * 0.33;
    // group.linewidth 在 Two.js 0.8.x 上不一定有效；group 上 noStroke 也行
    group.translation.set(stage.width / 2, stage.height / 2);
  }

  function buildTweens(): void {
    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    options.in = 0;
    options.out = 0;

    group.visible = false;
    group.opacity = 1;
    group.rotation = Math.random() * Math.PI * 2;
    a.translation.clear();
    b.translation.clear();

    animateIn = new TWEEN.Tween(options)
      .to({ in: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Circular.In)
      .onUpdate(() => {
        group.visible = Math.random() < options.in;
      })
      .onComplete(() => {
        group.visible = true;
        animateOut?.start();
      });

    animateOut = new TWEEN.Tween(options)
      .to({ out: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Circular.Out)
      .delay(DURATION * 0.35)
      .onUpdate(() => {
        const t = Math.pow(options.out, 0.5) * 0.5;
        a.translation.y = t;
        b.translation.y = -t;
        group.opacity = 1 - options.out;
      })
      .onComplete(() => {
        playing = false;
        buildTweens();
      });
  }

  applyResize();
  buildTweens();

  return {
    key: 'c',
    name: 'splits',
    start: () => {
      if (playing) return;
      playing = true;
      a.fill = a.stroke = palette.colors.foreground;
      b.fill = b.stroke = palette.colors.foreground;
      group.visible = true;
      animateIn?.start();
    },
    reset: () => {
      playing = false;
      buildTweens();
    },
    onResize: () => {
      applyResize();
      buildTweens();
    },
  };
};
