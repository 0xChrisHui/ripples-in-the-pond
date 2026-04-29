/**
 * Phase 6 B2 — flashes 动画（移植 references/patatap/src/animations/flashes.js）
 *
 * 视觉：覆盖整个画面的矩形，闪烁出现（随机 visible）持续 duration*0.25。
 * 3 个变体的差异：fill 取自 palette 反向索引的不同颜色键。
 * 键位：q (0) / a (1) / z (2)
 *
 * 注：原始 patatap 代码用 `palette.keys` 反向索引；这里直接 hardcode 3 个色键
 * （palette.keys = ['background','middleground','foreground','highlight','accent','white','black']
 *  反向 i=0 → 'black'; i=1 → 'white'; i=2 → 'accent'）
 *
 * 实现：原 patatap 用 two.bind('update') 每帧切换；这里用一个 dummy TWEEN 跑 0→1 让
 * onUpdate 每帧触发（全局 RAF 已驱动 TWEEN.update），动画到时自动 reset。
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { DURATION } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';
import type { PatatapColors } from '../palette';

const COLOR_KEYS: (keyof PatatapColors)[] = ['black', 'white', 'accent'];

const KEYS = ['q', 'a', 'z'] as const;

function buildFlashEffect(stage: Two, variant: 0 | 1 | 2, key: string): AnimationEffect {
  const colorKey = COLOR_KEYS[variant];

  // 用 4 顶点 Path 当全屏矩形（与 wipe.ts 同模式）
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
  shape.noStroke();
  shape.visible = false;
  shape.fill = palette.colors[colorKey];
  shape.translation.set(stage.width / 2, stage.height / 2);

  let playing = false;
  let flicker: TWEEN.Tween | null = null;
  const ticker = { t: 0 };

  function buildTween(): void {
    if (flicker) flicker.stop();
    ticker.t = 0;
    flicker = new TWEEN.Tween(ticker)
      .to({ t: 1 }, DURATION * 0.25)
      .onUpdate(() => {
        if (playing) {
          shape.visible = Math.random() > 0.5;
        }
      })
      .onComplete(() => {
        playing = false;
        shape.visible = false;
      });
  }

  function applyResize(): void {
    points[0].set(-cx(), -cy());
    points[1].set(cx(), -cy());
    points[2].set(cx(), cy());
    points[3].set(-cx(), cy());
    shape.translation.set(stage.width / 2, stage.height / 2);
  }

  buildTween();

  return {
    key,
    name: `flashes-${variant + 1}`,
    start: () => {
      // 重新触发 — 重建 tween 重启
      playing = true;
      shape.fill = palette.colors[colorKey];
      buildTween();
      flicker?.start();
    },
    reset: () => {
      playing = false;
      shape.visible = false;
      buildTween();
    },
    onResize: () => {
      applyResize();
    },
  };
}

export const flashesFactories: EffectFactory[] = [
  (stage) => buildFlashEffect(stage, 0, KEYS[0]),
  (stage) => buildFlashEffect(stage, 1, KEYS[1]),
  (stage) => buildFlashEffect(stage, 2, KEYS[2]),
];
