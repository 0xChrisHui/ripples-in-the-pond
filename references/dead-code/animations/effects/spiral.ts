/**
 * Phase 6 B2 — spiral / dotted-spiral 动画（移植 references/patatap/src/animations/spiral.js）
 *
 * 视觉：120 条短线段沿对数螺旋从中心向外铺，
 * 触发时整个 group rotation 转回正向 + scale 1→8 同步逐个显现 line。
 * 键位：p（patatap hash 0,9）
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';
import { TWO_PI, DURATION, range, clamp, map } from '../utils';
import { palette } from '../palette';
import type { EffectFactory, AnimationEffect } from '../types';

const AMOUNT = 120;
const RESOLUTION = 4;

export const createSpiral: EffectFactory = (stage): AnimationEffect => {
  const group = stage.makeGroup();
  const lines: InstanceType<typeof Two.Line>[] = range(AMOUNT).map(() => {
    const line = new Two.Line(0, 0, 0, 0);
    line.noFill();
    line.cap = 'round';
    line.join = 'round';
    line.stroke = palette.colors.black;
    group.add(line);
    return line;
  });

  let animateIn: TWEEN.Tween | null = null;
  let playing = false;
  let magnitude = 0;
  let linewidth = 0;

  function updateLine(line: InstanceType<typeof Two.Line>, i: number): void {
    let pct = i / AMOUNT;
    let r = magnitude * pct;
    let theta = pct * Math.PI * RESOLUTION;
    const x1 = r * Math.cos(theta);
    const y1 = r * Math.sin(theta);

    pct = (i + 0.25) / AMOUNT;
    r = magnitude * pct;
    theta = pct * Math.PI * RESOLUTION;
    const x2 = r * Math.cos(theta);
    const y2 = r * Math.sin(theta);

    line.vertices[0].set(x1, y1);
    line.vertices[1].set(x2, y2);
    line.linewidth = (1 - Math.sqrt(1 - pct)) * linewidth;
  }

  function applyResize(): void {
    group.translation.set(stage.width / 2, stage.height / 2);
    const min = Math.min(stage.width, stage.height);
    magnitude = min / 2;
    linewidth = magnitude / AMOUNT;
    lines.forEach(updateLine);
    // patatap 原版有 lines.reverse() — 但因 group.add 已固定 z 序，
    // 逆序仅影响 visible 揭示方向。保留。
    lines.reverse();
  }

  function buildTweens(): void {
    if (animateIn) animateIn.stop();

    group.visible = false;
    group.rotation = Math.PI - Math.random() * TWO_PI;
    group.scale = 1;

    animateIn = new TWEEN.Tween(group)
      .easing(TWEEN.Easing.Circular.In)
      .to({ rotation: Math.PI / 8, scale: 8 }, DURATION * 2)
      .onUpdate((g: typeof group) => {
        // 通过 group.scale 当前值反推 tween 进度（1→8）
        const scaleNow = typeof g.scale === 'number' ? g.scale : 1;
        const u = (scaleNow - 1) / 7;
        const t = clamp(map(u, 0, 0.25, 0, 1), 0, 1);
        const index = Math.floor(t * AMOUNT);
        for (let i = 0; i < lines.length; i++) {
          lines[i].visible = i <= index;
        }
      })
      .onComplete(() => {
        playing = false;
        buildTweens();
      });

    playing = false;
  }

  applyResize();
  buildTweens();

  return {
    key: 'p',
    name: 'spiral',
    start: () => {
      if (playing) return;
      playing = true;
      group.visible = true;
      // 颜色刷新（patatap update() 等价）
      lines.forEach((l) => { l.stroke = palette.colors.black; });
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
