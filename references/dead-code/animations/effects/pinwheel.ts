/**
 * Phase 6 B2 — pinwheel 动画（移植 references/patatap/src/animations/pinwheel.js）
 *
 * 视觉：8 个 anchor 围成 closed path，初始全部叠在 (radius, 0)。
 * 然后按 8 步并行 tween，把每个顶点散开到圆周上不同角度，最后整体 scale 0 收掉。
 * 键位：k（patatap hash 1,7）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 8;

export const createPinwheel: EffectFactory = (stage): AnimationEffect => {
  const points = range(AMOUNT).map(() => new Two.Anchor());
  const shape = stage.makePath(points);
  shape.closed = true;
  shape.noStroke();
  shape.fill = palette.colors.highlight;
  shape.visible = false;

  const sequence: TWEEN.Tween[][] = [];
  let animateOut: TWEEN.Tween | null = null;
  let playing = false;

  function buildTweens(): void {
    if (sequence.length > 0) {
      for (const parallel of sequence) {
        for (const t of parallel) t.stop();
      }
      sequence.length = 0;
    }
    if (animateOut) animateOut.stop();

    shape.visible = false;
    shape.scale = 1;
    shape.rotation = Math.random() * TWO_PI;
    shape.translation.set(stage.width / 2, stage.height / 2);

    const startAngle = 0;
    const endAngle = TWO_PI;
    const drift = Math.random() * TWO_PI;
    const radius = stage.height / 6;

    // 初始：所有顶点叠在 (radius * cos(0), radius * sin(0)) = (radius, 0)
    shape.vertices.forEach((v) => {
      v.set(radius * Math.cos(startAngle), radius * Math.sin(startAngle));
    });

    // 构建 8 步并行 tween：第 i 步把前 i+1 个顶点扇形展开到对应角度
    shape.vertices.forEach((_, i) => {
      const index = i + 1;
      const centerAngle = Math.PI * (index / AMOUNT);

      const parallel = range(AMOUNT).map((j) => {
        const t = Math.min(j / index, 1);
        const angle = t * (endAngle - startAngle) + startAngle + centerAngle + drift;
        const p = shape.vertices[j];
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        return new TWEEN.Tween(p)
          .to({ x, y }, DURATION / (AMOUNT + 2))
          .easing(TWEEN.Easing.Sinusoidal.Out);
      });

      sequence.push(parallel);

      // 每一并行组的第 0 个 tween onComplete 触发下一组（或最终 animateOut）
      parallel[0].onComplete(() => {
        const next = sequence[index];
        if (next && next.length > 0) {
          next.forEach((tween) => tween.start());
          return;
        }
        animateOut?.start();
      });
    });

    animateOut = new TWEEN.Tween(shape)
      .to({ scale: 0 }, DURATION / (AMOUNT + 2))
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 'k',
    name: 'pinwheel',
    start: () => {
      if (playing) return;
      playing = true;
      shape.visible = true;
      shape.fill = palette.colors.highlight;
      if (sequence.length > 0) {
        sequence[0].forEach((t) => t.start());
      }
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
