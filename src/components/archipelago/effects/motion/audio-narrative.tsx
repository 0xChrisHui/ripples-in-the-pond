'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import type { EffectsConfig } from '../../effects-config';
import { useAudioEnergy, getAudioBeatAt, getAudioEnv } from '../../hooks/pond/use-audio-energy';
import {
  getPlaySpherePos,
  setAudioPulseEnabled,
} from '../../hooks/pond/use-play-sphere-pos';
import Bubbles from './bubbles';

/**
 * Phase 8 Lane D 协调组件 — C1 beatRipple + F2 echoRipple/playWaves/bubbles/lightFollow。
 *
 * 自挂 fixed overlay（不进 SphereCanvas/sim，避开 Lane A/E）。挂载点：Archipelago 氛围区追加一行。
 * 音频能量经 use-audio-energy（C1）分析；播放球屏幕坐标读 use-play-sphere-pos store。
 * audioPulse 的绑定在月亮（render-eclipse-moon，已接）+ 球（use-sphere-sim，Lane A 待主会话补 4 行），
 * 这里只负责把 audioPulse flag 镜像给 render-eclipse-moon 读。
 */

interface Props {
  effects: EffectsConfig;
}

// 派生小涟漪：走涟漪总线 prio:2（播放叙事级）
function spawnRipple(x: number, y: number, size: number, duration: number, wave: boolean): void {
  window.dispatchEvent(new CustomEvent('bg-ripple:spawn', {
    detail: { x, y, size, duration, prio: 2 },
  }));
  if (wave) {
    window.dispatchEvent(new CustomEvent('bg-ripple:wave', {
      detail: { x, y, size, duration },
    }));
  }
}

export default function AudioNarrative({ effects }: Props) {
  const { playing, currentTrack, getAudioElement } = usePlayer();
  const audioFlagsOn =
    effects.audioPulse || effects.beatRipple || effects.echoRipple || effects.playWaves;

  useAudioEnergy({ enabled: audioFlagsOn, playing, getAudioElement });

  // audioPulse flag 镜像给 render-eclipse-moon（非 React）
  useEffect(() => {
    setAudioPulseEnabled(effects.audioPulse && playing);
    return () => setAudioPulseEnabled(false);
  }, [effects.audioPulse, playing]);

  // beatRipple — 强拍以播放球为中心荡开离散涟漪（限流 ≥1.2s）
  const lastBeatHandledRef = useRef(0);
  const lastRippleAtRef = useRef(0);
  useEffect(() => {
    if (!effects.beatRipple || !playing) return;
    let raf = 0;
    const loop = () => {
      const beatAt = getAudioBeatAt();
      const now = performance.now();
      if (beatAt > lastBeatHandledRef.current && now - lastRippleAtRef.current > 1200) {
        lastBeatHandledRef.current = beatAt;
        const pos = getPlaySpherePos();
        if (pos.visible) {
          lastRippleAtRef.current = now;
          const size = pos.r * 1.4 + 30 + getAudioEnv() * 60;
          spawnRipple(pos.x, pos.y, size, 3.5, true);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [effects.beatRipple, playing]);

  // echoRipple — 播放开始取最近 4-6 球，按距离排 0.3-0.8s 延迟各 dispatch（每曲一轮）
  useEffect(() => {
    if (!effects.echoRipple || !playing || !currentTrack) return;
    const timers: number[] = [];
    // 等播放球坐标就绪后再发（最多重试 ~1s）
    let tries = 0;
    const start = () => {
      const pos = getPlaySpherePos();
      if (!pos.visible) {
        if (tries++ < 20) { timers.push(window.setTimeout(start, 50)); }
        return;
      }
      const spheres = Array.from(document.querySelectorAll('[data-sphere]'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
        })
        .filter((s) => s.w > 0)
        .map((s) => ({ ...s, d: Math.hypot(s.cx - pos.x, s.cy - pos.y) }))
        .filter((s) => s.d > pos.r * 0.5) // 排除播放球自身
        .sort((a, b) => a.d - b.d)
        .slice(0, 4 + Math.floor(Math.random() * 3)); // 4-6 个
      const maxD = spheres.length ? spheres[spheres.length - 1].d : 1;
      spheres.forEach((s) => {
        const delay = 300 + (s.d / maxD) * 500; // 0.3-0.8s 按距离
        timers.push(window.setTimeout(() => {
          spawnRipple(s.cx, s.cy, Math.min(28, s.w * 0.6), 4, false);
        }, delay));
      });
    };
    timers.push(window.setTimeout(start, 120));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [effects.echoRipple, playing, currentTrack]);

  // playWaves — 播放球处 2-3 环同心环连续扩散，env 可用时乘能量包络
  const wavesLayerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!effects.playWaves || !playing) return;
    const layer = wavesLayerRef.current;
    if (!layer) return;
    const rings: HTMLDivElement[] = [];
    const RING_COUNT = 3;
    for (let i = 0; i < RING_COUNT; i++) {
      const ring = document.createElement('div');
      ring.className = 'pond-playwave';
      ring.style.animationDelay = `${(i / RING_COUNT) * 2}s`;
      layer.appendChild(ring);
      rings.push(ring);
    }
    let raf = 0;
    const follow = () => {
      const pos = getPlaySpherePos();
      const op = pos.visible ? 0.5 + getAudioEnv() * 0.5 : 0;
      layer.style.opacity = String(op);
      if (pos.visible) {
        layer.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        const base = Math.max(24, pos.r);
        layer.style.setProperty('--pw-base', `${base}px`);
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(raf);
      rings.forEach((r) => r.remove());
    };
  }, [effects.playWaves, playing]);

  // lightFollow — 月光斑/moonPath 是 Lane B 产物、本 worktree 没有 → 优雅降级订阅者：
  // 找不到目标元素就 no-op（flag 仍可开关不崩）。Wave 2 与 Lane B moonPath 同源汇合。
  useEffect(() => {
    if (!effects.lightFollow || !playing) return;
    const target = document.querySelector<HTMLElement>('[data-moon-path], [data-moonlight]');
    if (!target) return; // 降级 no-op（Lane B 未就绪）
    let raf = 0;
    const follow = () => {
      const pos = getPlaySpherePos();
      if (pos.visible) {
        const dx = Math.max(-0.15, Math.min(0.15, (pos.x / window.innerWidth) - 0.35)) * window.innerWidth;
        const dy = Math.max(-0.15, Math.min(0.15, (pos.y / window.innerHeight) + 0.1)) * window.innerHeight;
        target.style.transition = 'transform 12s ease-out';
        target.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(raf);
      target.style.transform = '';
    };
  }, [effects.lightFollow, playing]);

  return (
    <>
      {effects.playWaves && (
        <div ref={wavesLayerRef} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-0" />
      )}
      {effects.bubbles && <Bubbles playing={playing} />}
    </>
  );
}
