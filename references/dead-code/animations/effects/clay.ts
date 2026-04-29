/**
 * Phase 6 B2 — clay 动画（移植 references/patatap/src/animations/clay.js）
 *
 * 视觉：从屏幕 8 个边角/中点之一发射，一团圆形闭合曲线被随机"冲击点"
 * 拉扯变形（每个 anchor 朝目标点 lerp），最后整体收回。
 * 键位：w（patatap hash 0,1）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 12;

export const createClay: EffectFactory = (stage): AnimationEffect => {
  const destinations = range(AMOUNT).map(() => new Two.Vector());
  const points = range(AMOUNT).map(() => new Two.Anchor());

  // makeCurve：插值平滑的闭合曲线
  const clay = stage.makeCurve(points);
  clay.fill = palette.colors.middleground;
  clay.closed = true;
  clay.noStroke();
  clay.visible = false;

  let animateIn: TWEEN.Tween | null = null;
  let playing = false;
  const options = { ending: 0 };
  const impact = new Two.Vector();

  function buildTweens(): void {
    if (animateIn) animateIn.stop();

    clay.visible = false;
    options.ending = 0;

    // 随机一个冲击点（屏幕内任意位置）
    impact.set(Math.random() * stage.width, Math.random() * stage.height);

    // 8 个发射位置（NE / E / SE / S / SW / W / NW / N）
    const cx = stage.width / 2;
    const cy = stage.height / 2;
    const w = stage.width;
    const h = stage.height;
    const pos = Math.floor(Math.random() * 8);
    let x: number;
    let y: number;
    switch (pos) {
      case 7: x = cx; y = 0; break;       // north
      case 6: x = 0; y = 0; break;         // north-west
      case 5: x = 0; y = cy; break;        // west
      case 4: x = 0; y = h; break;         // south-west
      case 3: x = cx; y = h; break;        // south
      case 2: x = w; y = h; break;         // south-east
      case 1: x = w; y = cy; break;        // east
      default: x = w; y = 0;               // north-east
    }
    clay.translation.set(x, y);

    const distance = stage.height;

    // 起点：以发射点为中心的小圆 + 计算每个 anchor 的目标（被冲击点拉偏）
    for (let i = 0; i < AMOUNT; i++) {
      const v = points[i];
      const pct = i / AMOUNT;
      const ptheta = pct * TWO_PI;

      v.set(distance * Math.cos(ptheta), distance * Math.sin(ptheta));

      // 注：Two.Vector.angleBetween 在 0.8.x 上存在；Anchor extends Vector 故 v 是 Vector 子类
      type Vec = InstanceType<typeof Two.Vector>;
      const theta = Two.Vector.angleBetween(v as unknown as Vec, impact) - ptheta;
      const d = (v as unknown as Vec).distanceTo(impact);
      const a = (10 * distance) / Math.sqrt(Math.max(d, 1));
      const dx = a * Math.cos(theta) + v.x;
      const dy = a * Math.sin(theta) + v.y;
      destinations[i].set(dx, dy);
    }

    animateIn = new TWEEN.Tween(options)
      .to({ ending: 1 }, DURATION * 0.75)
      .easing(TWEEN.Easing.Circular.In)
      .onUpdate(() => {
        for (let i = 0; i < AMOUNT; i++) {
          (points[i] as unknown as InstanceType<typeof Two.Vector>).lerp(destinations[i], options.ending);
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
    key: 'w',
    name: 'clay',
    start: () => {
      if (playing) return;
      playing = true;
      clay.visible = true;
      clay.fill = palette.colors.middleground;
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
