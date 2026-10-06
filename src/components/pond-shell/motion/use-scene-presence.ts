'use client';
import { useRef, type RefObject } from 'react';
import type { PondTransitionPhase } from '../pond-transition';
import { scenePresenceRef } from './scene-presence';

/** 首页GL直接共享前景数值，测试沙盒仍保持独立会话。 */
export function useScenePresence(phase: PondTransitionPhase, duration: number, persistent = false): {
  presence: RefObject<number>; reduced: boolean;
} {
  const standalone = useRef(phase === 'home' || phase === 'entering-home' ? 1 : 0);
  return { presence: persistent ? scenePresenceRef('home') : standalone, reduced: duration <= 160 };
}
