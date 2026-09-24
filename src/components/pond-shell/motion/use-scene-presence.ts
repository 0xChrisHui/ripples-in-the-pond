'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { PondTransitionPhase } from '../pond-transition';

function targetOf(phase: PondTransitionPhase): number {
  return phase === 'home' || phase === 'entering-home' ? 1 : 0;
}

/** 与 --p11-ease-out 的 cubic-bezier(0.16, 1, 0.3, 1) 同步。 */
function routeEase(progress: number): number {
  let t = progress;
  for (let index = 0; index < 6; index += 1) {
    const remaining = 1 - t;
    const x = 0.48 * remaining * remaining * t
      + 0.9 * remaining * t * t + t * t * t;
    const slope = 0.48 * remaining * remaining
      + 0.84 * remaining * t + 2.1 * t * t;
    t = Math.max(0, Math.min(1, t - (x - progress) / slope));
  }
  return 1 - (1 - t) ** 3;
}

/** RAF 持有连续值，路由反向时从当前帧续跑，不触发每帧 React 渲染。 */
export function useScenePresence(
  phase: PondTransitionPhase,
  duration: number,
): { presence: RefObject<number>; reduced: boolean } {
  const initial = targetOf(phase);
  const presence = useRef(initial);
  const animationVersion = useRef(0);
  const reduced = duration <= 160;

  useLayoutEffect(() => {
    const version = animationVersion.current + 1;
    animationVersion.current = version;
    const target = targetOf(phase);
    // 稳定页不允许上一段动画的尾帧继续把圆圈留在水面上。
    if (phase === 'home' || phase === 'archive' || phase === 'score') {
      presence.current = target;
      return;
    }
    const from = presence.current;
    if (from === target) return;
    const startedAt = performance.now();
    const span = Math.max(1, duration * Math.abs(target - from));
    let frame = 0;
    const tick = (now: number) => {
      if (animationVersion.current !== version) return;
      const linear = Math.min(1, (now - startedAt) / span);
      const eased = routeEase(linear);
      presence.current = from + (target - from) * eased;
      if (linear < 1) frame = requestAnimationFrame(tick);
      else presence.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      animationVersion.current += 1;
      cancelAnimationFrame(frame);
    };
  }, [duration, phase]);

  return { presence, reduced };
}
