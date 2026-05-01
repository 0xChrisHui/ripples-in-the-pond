'use client';

import { useEffect, useRef, useState } from 'react';
import type { EffectsConfig } from '../effects-config';

/**
 * v87 L 方案 — 自适应品质
 *
 * effects.adaptiveQuality = true 时启动 FPS 监控：
 *   - FPS &lt; 30 持续 2s → 按降级表关下一个 effect
 *   - FPS &gt; 55 持续 15s → 恢复最近一个被关的（hysteresis 防震荡）
 *
 * 设计原则：adaptive 只能 force-off，不能 force-on。
 *   用户在面板手动关掉 → 永远 off，adaptive 不动
 *   用户在面板手动开启 → adaptive 视 FPS 决定要不要强行覆盖关掉
 *
 * adaptiveQuality 关闭时 → passthrough（effects 原样返回，已自动恢复 disabled 集）
 *
 * 降级表是固定优先级——把性能成本最大的先关：
 *   comet（每帧 ~150 SVG 元素重建）→ sphereRipple（108 个动画 circle）
 *   → layerWave2 → fog/aurora/stars（最便宜的最后关）
 *
 * 不动 focus / tilt / perspective / bgRipples / gradientGlow / viewportCull —
 * 这些是核心交互或视觉基底，关掉用户感知差异太大。
 */

const DEGRADATION_ORDER: (keyof EffectsConfig)[] = [
  'comet',
  'sphereRipple',
  'layerWave2',
  'fog',
  'aurora',
  'stars',
];

const FPS_DOWN = 30;
const FPS_UP = 55;
const DOWN_MS = 2000;
const UP_MS = 15000;

export function useAdaptiveEffects(effects: EffectsConfig): EffectsConfig {
  const [disabled, setDisabled] = useState<Set<keyof EffectsConfig>>(() => new Set());
  const stateRef = useRef({ frames: 0, windowStart: 0, lowSince: 0, highSince: 0 });

  useEffect(() => {
    if (!effects.adaptiveQuality) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisabled((prev) => (prev.size > 0 ? new Set() : prev));
      return;
    }
    const s = stateRef.current;
    s.frames = 0;
    s.windowStart = performance.now();
    s.lowSince = 0;
    s.highSince = 0;

    let raf = 0;
    const loop = () => {
      const now = performance.now();
      s.frames++;
      const elapsed = now - s.windowStart;
      if (elapsed >= 1000) {
        const fps = (s.frames * 1000) / elapsed;
        s.frames = 0;
        s.windowStart = now;

        if (fps < FPS_DOWN) {
          if (s.lowSince === 0) s.lowSince = now;
          s.highSince = 0;
          if (now - s.lowSince > DOWN_MS) {
            setDisabled((prev) => {
              const next = DEGRADATION_ORDER.find((k) => !prev.has(k));
              if (!next) return prev;
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[AdaptiveQuality] FPS ${fps.toFixed(0)} → disable ${next}`);
              }
              return new Set([...prev, next]);
            });
            s.lowSince = 0;
          }
        } else if (fps > FPS_UP) {
          if (s.highSince === 0) s.highSince = now;
          s.lowSince = 0;
          if (now - s.highSince > UP_MS) {
            setDisabled((prev) => {
              if (prev.size === 0) return prev;
              const reverse = [...DEGRADATION_ORDER].reverse();
              const restore = reverse.find((k) => prev.has(k));
              if (!restore) return prev;
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[AdaptiveQuality] FPS ${fps.toFixed(0)} → restore ${restore}`);
              }
              const nextSet = new Set(prev);
              nextSet.delete(restore);
              return nextSet;
            });
            s.highSince = 0;
          }
        } else {
          s.lowSince = 0;
          s.highSince = 0;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [effects.adaptiveQuality]);

  if (disabled.size === 0) return effects;
  const result = { ...effects };
  for (const key of disabled) result[key] = false;
  return result;
}
