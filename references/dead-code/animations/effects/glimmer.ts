/**
 * Phase 6 B2 — glimmer 动画（移植 references/patatap/src/animations/glimmer.js）
 *
 * 视觉：12 个细圆环散点出现，scale 0→1 同时 linewidth 大→0，错峰出现像微光。
 * 用 Polygon(0,0,1,40) 当圆环 + scale 控制半径；linewidth 走 stroke 用 group.stroke 设色。
 * 键位：o（patatap hash 0,8）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range, map } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 12;

type Ring = InstanceType<typeof Two.Polygon> & { tween?: TWEEN.Tween };

export const createGlimmer: EffectFactory = (stage): AnimationEffect => {
  const colorKeys: Array<keyof typeof palette.colors> = [
    'background', 'middleground', 'foreground', 'highlight', 'accent',
  ];

  const circles: Ring[] = range(AMOUNT).map(() => {
    const c = new Two.Polygon(0, 0, 1, 40) as Ring;
    c.noFill();
    return c;
  });

  const group = stage.makeGroup(circles);
  let playing = false;

  function pickColor(): string {
    const k = colorKeys[Math.floor(Math.random() * colorKeys.length)];
    return palette.colors[k];
  }

  function buildTweens(): void {
    let longestIndex = 0;
    let longestDelay = 0;

    const min = Math.min(stage.width, stage.height);
    const innerRadius = stage.height * 2 / 90;
    const outerRadius = stage.height * 4 / 90;
    const cy = stage.height / 2;

    group.translation.set(stage.width / 2, stage.height / 2);

    circles.forEach((circle, i) => {
      const theta = TWO_PI * Math.random();
      const x = Math.random() * cy * Math.cos(theta);
      const y = Math.random() * cy * Math.sin(theta);
      const delay = Math.random() * DURATION * 0.5;

      circle.translation.set(x, y);
      circle.visible = false;
      circle.scale = 0;
      circle.stroke = pickColor();
      // Polygon radius=1, target 半径用 scale；初始 baseRadius 决定外圈大小
      const baseRadius = Math.round(map(Math.random(), 0, 1, innerRadius, outerRadius));
      // scale 终点 = baseRadius（用 scale 直接表达半径）
      const targetScale = baseRadius;
      circle.linewidth = Math.random() * 20 + 40;

      if (circle.tween) circle.tween.stop();

      circle.tween = new TWEEN.Tween(circle)
        .to({ scale: targetScale, linewidth: 0 }, 0.2 * DURATION)
        .easing(TWEEN.Easing.Sinusoidal.Out)
        .delay(delay)
        .onStart(() => { circle.visible = true; })
        .onComplete(() => { circle.visible = false; });

      // unused but keep min reference to silence ts
      void min;

      if (longestDelay < delay) {
        longestDelay = delay;
        longestIndex = i;
      }
    });

    // 最晚结束的那个收尾 → reset
    const last = circles[longestIndex];
    if (last.tween) {
      last.tween.onComplete(() => {
        last.visible = false;
        playing = false;
        buildTweens();
      });
    }
  }

  buildTweens();

  return {
    key: 'o',
    name: 'glimmer',
    start: () => {
      if (playing) return;
      playing = true;
      group.visible = true;
      circles.forEach((c) => c.tween?.start());
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
