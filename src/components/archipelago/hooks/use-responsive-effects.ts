'use client';

import { useSyncExternalStore } from 'react';
import {
  DESKTOP_EFFECTS,
  MOBILE_EFFECTS,
  EFFECTS_META,
  type EffectsConfig,
} from '../effects-config';

/**
 * v87 — 响应式 effects 默认值
 *
 * 视口宽 ≤ 767px（iPad 768 之下）→ MOBILE_EFFECTS（仅 comet/stars/aurora/bgRipples）
 * 否则                          → DESKTOP_EFFECTS（10 个全开）
 *
 * SSR / hydration：
 *   - 服务端 + 首次 client render 都返回 DESKTOP（getServerSnapshot 锁定）
 *   - 客户端 mount 后 matchMedia 命中手机即 re-render 切 MOBILE
 *   - 这正是 useSyncExternalStore 设计的外部状态订阅模式，React 18 不会 hydration warning
 *
 * 视口跨阈值（横竖屏切换 / 浏览器 resize）会自动重算，由 mq.change 事件驱动。
 *
 * Lane D（C1）— prefers-reduced-motion 无障碍 gate：命中 reduce 时**规则式**关掉
 * EFFECTS_META 中 group==='运动' 的全部 flag（遍历判 group，不列举清单，新增运动 flag
 * 自动覆盖）。这是 a11y 基线，不立 flag；作用在设备基线上。
 */
const MOBILE_QUERY = '(max-width: 767px)';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mqMobile = window.matchMedia(MOBILE_QUERY);
  const mqReduce = window.matchMedia(REDUCE_QUERY);
  mqMobile.addEventListener('change', callback);
  mqReduce.addEventListener('change', callback);
  return () => {
    mqMobile.removeEventListener('change', callback);
    mqReduce.removeEventListener('change', callback);
  };
}

// 缓存 4 种 (mobile × reduce) 组合的结果对象，保证 getSnapshot 引用稳定（避免无限 re-render）
const gatedCache = new Map<string, EffectsConfig>();

function applyReducedMotion(base: EffectsConfig): EffectsConfig {
  const next = { ...base };
  for (const meta of EFFECTS_META) {
    if (meta.group === '运动') next[meta.key] = false;
  }
  return next;
}

function getSnapshot(): EffectsConfig {
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const reduce = window.matchMedia(REDUCE_QUERY).matches;
  const key = `${isMobile ? 'm' : 'd'}${reduce ? 'r' : ''}`;
  const cached = gatedCache.get(key);
  if (cached) return cached;
  const base = isMobile ? MOBILE_EFFECTS : DESKTOP_EFFECTS;
  const result = reduce ? applyReducedMotion(base) : base;
  gatedCache.set(key, result);
  return result;
}

function getServerSnapshot(): EffectsConfig {
  return DESKTOP_EFFECTS;
}

export function useResponsiveDefaultEffects(): EffectsConfig {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
