/**
 * Phase 6 B2 — Two.js scene singleton + RAF loop（管 TWEEN.update + two.update）
 *
 * 仅 client-side（依赖 DOM）。SSR 调用会抛错。
 */
import Two from 'two.js';
import * as TWEEN from '@tweenjs/tween.js';

let stage: Two | null = null;
let rafId = 0;

export function ensureStage(container: HTMLElement): Two {
  if (stage) return stage;

  stage = new Two({
    type: Two.Types.canvas,
    fullscreen: true,
    autostart: false,
  }).appendTo(container);

  // canvas 全屏 + 不挡交互
  const canvas = stage.renderer.domElement as HTMLCanvasElement;
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.pointerEvents = 'none';

  function loop(time: number) {
    TWEEN.update(time);
    stage!.update();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  return stage;
}

export function destroyStage(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (stage) {
    const canvas = stage.renderer.domElement as HTMLCanvasElement;
    canvas.remove();
    stage = null;
  }
  TWEEN.removeAll();
}

export function getStage(): Two | null {
  return stage;
}
