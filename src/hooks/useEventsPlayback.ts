'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { useJam } from './useJam';
import type { KeyEvent } from '@/src/types/jam';

/**
 * useEventsPlayback — 按 events 时间序列触发音效
 *
 * A13 修复：拆 audioReady（fetch 完成）/ decodeReady（AudioBuffer decode 完成）。
 * isMine && ready 时主动触发 decode，等 decodeReady 才启动事件时钟，
 * 避免 decode 期间事件排队完成后集中爆发播放导致时序错乱。
 */
export function useEventsPlayback({
  events,
  trackId,
}: {
  events: KeyEvent[];
  trackId: string;
}) {
  const { playing, currentTrack, getCurrentTime, startedAt } = usePlayer();
  const { playSound, ready, decodeReady, triggerDecode } = useJam();
  const indexRef = useRef(0);

  const isMine = playing && currentTrack?.id === trackId;

  // A13: 播放开始且 mp3 就绪时，立刻主动触发 AudioBuffer decode（不等第一次 playSound 懒触发）
  useEffect(() => {
    if (isMine && ready && !decodeReady) triggerDecode();
  }, [isMine, ready, decodeReady, triggerDecode]);

  // 等 decodeReady 才启动 RAF 事件时钟，确保 playSound 调用时 buffer 已就绪
  useEffect(() => {
    if (!isMine || !decodeReady) return;

    indexRef.current = 0;
    let raf = 0;
    const tick = () => {
      const elapsedMs = (getCurrentTime() - startedAt) * 1000;
      while (
        indexRef.current < events.length &&
        events[indexRef.current].time <= elapsedMs
      ) {
        playSound(events[indexRef.current].key);
        indexRef.current++;
      }
      if (indexRef.current < events.length) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isMine, decodeReady, events, getCurrentTime, startedAt, playSound]);
}
