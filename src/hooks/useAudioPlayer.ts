'use client';

import { useRef, useState, useCallback } from 'react';

/**
 * 音频播放 hook — 基于 Web Audio API
 * AudioContext 在首次用户手势时才创建（浏览器策略要求）
 */
export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);

  // 确保 AudioContext 只创建一次
  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(async (src: string) => {
    const ctx = getContext();

    // 停掉上一首
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }

    const res = await fetch(src);
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setPlaying(false);
    source.start();

    sourceRef.current = source;
    setPlaying(true);
  }, [getContext]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setPlaying(false);
  }, []);

  const toggle = useCallback(async (src: string) => {
    if (playing) {
      stop();
    } else {
      await play(src);
    }
  }, [playing, play, stop]);

  return { playing, toggle };
}
