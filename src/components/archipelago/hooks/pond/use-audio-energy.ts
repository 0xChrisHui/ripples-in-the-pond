'use client';

import { useEffect, useRef } from 'react';

/**
 * Phase 8-C C1 / Lane D — Web Audio 能量 / 节拍分析（零依赖）。
 *
 * 仅当 enabled（任一音频 flag 开）且首次 playing=true 时才建 AudioContext + graph
 * （页面加载禁建，必须用户手势后/播放内——CONVENTIONS 3.2）。
 * graph：audio →(createMediaElementSource 仅一次) analyser → ctx.destination（必接 destination 否则静音）。
 * 每帧 getByteFrequencyData → bass(bins1-5) → 快攻慢放包络 env(0-1) + 长期均值 hist → beat。
 *
 * 输出走模块级 store（getAudioEnv/getAudioBeatAt），命令式消费者（render-eclipse-moon /
 * overlay 的 rAF）直接读，不触发 React re-render。
 */

let env = 0;            // 连续能量包络 0-1
let lastBeatAt = 0;     // 最近一次 beat 的 performance.now()

export function getAudioEnv(): number {
  return env;
}
/** 返回最近 beat 时间戳（performance.now ms）；消费者自己判是否"新 beat" */
export function getAudioBeatAt(): number {
  return lastBeatAt;
}

interface Args {
  enabled: boolean;
  playing: boolean;
  getAudioElement: () => HTMLAudioElement | null;
}

export function useAudioEnergy({ enabled, playing, getAudioElement }: Args): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const samplingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !playing) {
      // 停采样并把 env 归零淡出（不销毁 graph，下次播放复用）
      if (samplingRef.current) {
        samplingRef.current = false;
        cancelAnimationFrame(rafRef.current);
        const fade = () => {
          env *= 0.85;
          if (env > 0.002) rafRef.current = requestAnimationFrame(fade);
          else env = 0;
        };
        fade();
      }
      return;
    }

    const audio = getAudioElement();
    if (!audio) return;

    // 建图（仅一次；ref 守卫防 StrictMode 双跑 / createMediaElementSource 只能调一次）
    if (!ctxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        srcRef.current = src;
        analyserRef.current = analyser;
      } catch (err) {
        console.error('[audio-energy] graph build failed', err);
        return;
      }
    }

    const ctx = ctxRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;
    void ctx.resume(); // 每次 play 内 resume（自动播放策略 / iOS interrupted）

    const onVis = () => { if (!document.hidden) void ctx.resume(); };
    document.addEventListener('visibilitychange', onVis);

    const bins = new Uint8Array(analyser.frequencyBinCount);
    let hist = 0.12;
    samplingRef.current = true;
    const sample = () => {
      if (!samplingRef.current) return;
      analyser.getByteFrequencyData(bins);
      // bass = bins 1-5 均值（≈43-215Hz），归一化到 0-1
      let bass = 0;
      for (let i = 1; i <= 5; i++) bass += bins[i];
      bass = bass / 5 / 255;
      // 快攻 0.4 慢放 0.08 包络
      env += (bass - env) * (bass > env ? 0.4 : 0.08);
      hist += (bass - hist) * 0.02; // 长期均值
      const now = performance.now();
      if (bass > hist * 1.4 && bass > 0.12 && now - lastBeatAt > 280) lastBeatAt = now;
      rafRef.current = requestAnimationFrame(sample);
    };
    rafRef.current = requestAnimationFrame(sample);

    return () => {
      samplingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, playing, getAudioElement]);
}
