/**
 * Phase 6 B2 — prisms 动画（移植 references/patatap/src/animations/prisms.js）
 *
 * 视觉：以 N 边形为骨架（顶点上各有小圆），整体从 scale=0 缩放到 scale=10。
 * 3 个变体差异：边数（3 / 4 / 6），由 floor(i*1.5)+3 给出。
 * 键位：u (0, 3 边) / j (1, 4 边) / m (2, 6 边)
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const KEYS = ['u', 'j', 'm'] as const;
const TARGET_SCALE = 10;
const R1 = 100; // 多边形外接圆半径
const R2 = 2;   // 顶点小圆半径

function buildPrismEffect(stage: Two, variant: 0 | 1 | 2, key: string): AnimationEffect {
  const amount = Math.floor(variant * 1.5) + 3; // 3, 4, 6

  let playing = false;
  let animateIn: TWEEN.Tween | null = null;

  // 构造多边形顶点（圆周等分）
  const anchors: InstanceType<typeof Two.Anchor>[] = [];
  const circles: InstanceType<typeof Two.Circle>[] = [];

  for (let i = 0; i < amount; i++) {
    const pct = i / amount;
    const theta = TWO_PI * pct;
    const x = R1 * Math.cos(theta);
    const y = R1 * Math.sin(theta);
    anchors.push(new Two.Anchor(x, y));
    const circle = new Two.Circle(x, y, R2);
    circle.fill = palette.colors.black;
    circle.noStroke();
    circles.push(circle);
  }

  const prism = new Two.Path(anchors, true);
  prism.closed = true;
  prism.stroke = palette.colors.black;
  prism.noFill();
  prism.linewidth = 0.5;

  const group = stage.makeGroup(prism, ...circles);
  group.translation.set(stage.width / 2, stage.height / 2);
  group.visible = false;
  group.scale = 0;

  function applyResize(): void {
    group.translation.set(stage.width / 2, stage.height / 2);
  }

  function buildTweens(): void {
    if (animateIn) animateIn.stop();

    group.visible = false;
    group.rotation = Math.floor(Math.random() * 4) * TWO_PI / 4;
    group.scale = 0;

    animateIn = new TWEEN.Tween(group)
      .to({ scale: TARGET_SCALE }, DURATION * 0.75)
      .easing(TWEEN.Easing.Circular.In)
      .onComplete(() => {
        playing = false;
        buildTweens();
      });
  }

  buildTweens();

  return {
    key,
    name: `prisms-${variant + 1}`,
    start: () => {
      if (playing) return;
      playing = true;
      prism.stroke = palette.colors.black;
      circles.forEach((c) => {
        c.fill = palette.colors.black;
      });
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
}

export const prismsFactories: EffectFactory[] = [
  (stage) => buildPrismEffect(stage, 0, KEYS[0]),
  (stage) => buildPrismEffect(stage, 1, KEYS[1]),
  (stage) => buildPrismEffect(stage, 2, KEYS[2]),
];
