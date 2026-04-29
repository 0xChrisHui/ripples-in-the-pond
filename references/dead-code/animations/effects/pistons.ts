/**
 * Phase 6 B2 — pistons 动画（移植 references/patatap/src/animations/pistons.js）
 *
 * 视觉：垂直分布的 (i*4+1) 条水平矩形条，左侧从 begin → end 扫入（animate_in）
 * 然后右侧 begin → end 扫出（animate_out）。
 * 3 个变体差异：条数不同（1 / 5 / 9）。
 * 键位：r (0, 1 条) / f (1, 5 条) / v (2, 9 条)
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { DURATION, range } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const KEYS = ['r', 'f', 'v'] as const;

function createBar(width: number, height: number): InstanceType<typeof Two.Path> {
  const points = [
    new Two.Anchor(-width / 2, -height / 2),
    new Two.Anchor(width / 2, -height / 2),
    new Two.Anchor(width / 2, height / 2),
    new Two.Anchor(-width / 2, height / 2),
  ];
  const path = new Two.Path(points, true);
  return path;
}

function buildPistonEffect(stage: Two, variant: 0 | 1 | 2, key: string): AnimationEffect {
  const amount = variant * 4 + 1;

  let playing = false;
  let animateIn: TWEEN.Tween | null = null;
  let animateOut: TWEEN.Tween | null = null;
  let begin = 0;
  let end = 0;

  const group = stage.makeGroup();
  group.translation.set(stage.width / 2, stage.height / 2);
  group.fill = palette.colors.white;

  // 创建 amount 条横条
  const w0 = stage.width * 0.75;
  const h0 = stage.height / 2;
  const d0 = h0 / amount - h0 / (amount * 3);

  const shapes: InstanceType<typeof Two.Path>[] = range(amount).map((i) => {
    const y = -h0 / 2 + (i + 1) * (h0 / (amount + 1));
    const shape = createBar(w0, d0);
    shape.translation.set(0, y);
    shape.fill = palette.colors.white;
    shape.noStroke();
    group.add(shape);
    return shape;
  });

  const options = { ending: 0, beginning: 0 };

  function applyBarLayout(): void {
    const w = stage.width * 0.75;
    const h = stage.height / 2;
    const d = h / amount - h / (amount * 3);
    for (let i = 0; i < amount; i++) {
      const shape = shapes[i];
      const y = -h / 2 + (i + 1) * (h / (amount + 1));
      shape.translation.set(0, y);
      // 重设矩形顶点 — 4 个 anchor
      const verts = shape.vertices;
      verts[0].set(-w / 2, -d / 2);
      verts[1].set(w / 2, -d / 2);
      verts[2].set(w / 2, d / 2);
      verts[3].set(-w / 2, d / 2);
    }
  }

  function buildTweens(): void {
    const w = stage.width * 0.75;

    if (animateIn) animateIn.stop();
    if (animateOut) animateOut.stop();

    options.beginning = 0;
    options.ending = 0;

    const rotated = Math.random() > 0.5;
    if (rotated) {
      begin = -w / 2;
      end = w / 2;
    } else {
      begin = w / 2;
      end = -w / 2;
    }

    // 重设：左右两侧顶点先全部塞到 begin
    for (let i = 0; i < amount; i++) {
      const shape = shapes[i];
      shape.visible = false;
      const verts = shape.vertices;
      verts[0].x = begin;
      verts[1].x = begin;
      verts[2].x = begin;
      verts[3].x = begin;
    }

    animateIn = new TWEEN.Tween(options)
      .to({ ending: 1 }, DURATION * 0.125)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onUpdate(() => {
        // 上方两顶点（0, 3 = top-left + bottom-left）扫到 end
        // 注：原 patatap 代码索引是 [0],[3] → 改为左侧 verts[0] 和 verts[3]
        for (let i = 0; i < amount; i++) {
          const verts = shapes[i].vertices;
          verts[0].x = end * options.ending;
          verts[3].x = end * options.ending;
        }
      })
      .onComplete(() => animateOut?.start());

    animateOut = new TWEEN.Tween(options)
      .to({ beginning: 1 }, DURATION * 0.125)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onUpdate(() => {
        // 右侧顶点 1, 2 扫到 end（追上左侧）
        for (let i = 0; i < amount; i++) {
          const verts = shapes[i].vertices;
          verts[1].x = end * options.beginning;
          verts[2].x = end * options.beginning;
        }
      })
      .onComplete(() => {
        playing = false;
        buildTweens();
      });
  }

  applyBarLayout();
  buildTweens();

  return {
    key,
    name: `pistons-${variant + 1}`,
    start: () => {
      if (playing) return;
      playing = true;
      shapes.forEach((s) => {
        s.fill = palette.colors.white;
        s.visible = true;
      });
      animateIn?.start();
    },
    reset: () => {
      playing = false;
      buildTweens();
    },
    onResize: () => {
      group.translation.set(stage.width / 2, stage.height / 2);
      applyBarLayout();
      buildTweens();
    },
  };
}

export const pistonsFactories: EffectFactory[] = [
  (stage) => buildPistonEffect(stage, 0, KEYS[0]),
  (stage) => buildPistonEffect(stage, 1, KEYS[1]),
  (stage) => buildPistonEffect(stage, 2, KEYS[2]),
];
