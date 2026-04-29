/**
 * Phase 6 B2 — confetti 动画（移植 references/patatap/src/animations/confetti.js）
 *
 * 视觉：32 个不同颜色 / 大小的小圆从屏幕一侧（N/E/S/W 任选）射向中心方向，
 * 朝目标点做 lerp 扩散。颜色每个圆从 palette 的 5 个 key 里随机挑一个。
 * 键位：n（patatap hash 2,5）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { DURATION, range, map } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 32;

type ColorKey = 'background' | 'middleground' | 'foreground' | 'highlight' | 'accent';
const COLOR_KEYS: ColorKey[] = ['background', 'middleground', 'foreground', 'highlight', 'accent'];

type CircleX = InstanceType<typeof Two.Circle> & { property: ColorKey };

export const createConfetti: EffectFactory = (stage): AnimationEffect => {
  const destinations = range(AMOUNT).map(() => new Two.Vector());

  const circles: CircleX[] = range(AMOUNT).map(() => {
    const c = new Two.Circle(0, 0, 1) as CircleX;
    c.property = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
    c.fill = palette.colors[c.property];
    c.noStroke();
    return c;
  });

  const group = stage.makeGroup(circles);

  let animateIn: TWEEN.Tween | null = null;
  let playing = false;
  const options = { ending: 0 };

  function buildTweens(): void {
    if (animateIn) animateIn.stop();

    group.visible = false;
    options.ending = 0;

    const cx = stage.width / 2;
    const cy = stage.height / 2;

    // 4 个发射方向（W / E / N / S）
    const pos = Math.floor(Math.random() * 4);
    let ox: number;
    let oy: number;
    switch (pos) {
      case 3: ox = -stage.width / 8; oy = cy; break;          // west
      case 2: ox = stage.width * 1.125; oy = cy; break;        // east
      case 1: ox = cx; oy = -stage.height / 8; break;          // north
      default: ox = cx; oy = stage.height * 1.125;             // south
    }
    group.translation.set(ox, oy);

    const theta = Math.atan2(cy - oy, cx - ox);
    const deviation = Math.PI / 2;
    const distance = stage.width;
    const min = Math.min(stage.width, stage.height);
    const r1 = (min * 12) / 900;
    const r2 = (min * 20) / 900;

    for (let i = 0; i < AMOUNT; i++) {
      const c = circles[i];
      const t = theta + (2 * Math.random() - 1) * deviation;
      const a = Math.random() * distance;
      const dx = a * Math.cos(t);
      const dy = a * Math.sin(t);
      destinations[i].set(dx, dy);

      c.translation.clear();
      c.radius = Math.max(1, Math.round(map(Math.random(), 0, 1, r1, r2)));
      c.fill = palette.colors[c.property];
    }

    animateIn = new TWEEN.Tween(options)
      .to({ ending: 1 }, DURATION * 0.5)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onUpdate(() => {
        for (let i = 0; i < AMOUNT; i++) {
          circles[i].translation.lerp(destinations[i], options.ending);
        }
      })
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  buildTweens();

  return {
    key: 'n',
    name: 'confetti',
    start: () => {
      if (playing) return;
      playing = true;
      group.visible = true;
      // 重新刷颜色（用户切 palette 时也能跟）
      circles.forEach((c) => { c.fill = palette.colors[c.property]; });
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
