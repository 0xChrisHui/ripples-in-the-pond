'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { useJam } from './useJam';
import type { KeyEvent } from '@/src/types/jam';

/**
 * useEventsPlayback — 按 events 时间序列触发音效
 *
 * 配合 PlayerProvider 用：底曲走 PlayerProvider（HTMLAudio + BottomPlayer 进度条），
 * 音效走 useJam.playSound 触发。两者用 PlayerProvider.getCurrentTime() 同步时钟，
 * 跟 useRecorder 录制时的时间基准一致。
 *
 * 仅在 currentTrack.id === trackId 时才触发（防多个 DraftCard 实例互相干扰）。
 */
export function useEventsPlayback({
  events,
  trackId,
}: {
  events: KeyEvent[];
  trackId: string;
}) {
  const { playing, currentTrack, getCurrentTime, startedAt } = usePlayer();
  const { playSound, ready } = useJam();
  const indexRef = useRef(0);

  const isMine = playing && currentTrack?.id === trackId;

  useEffect(() => {
    if (!isMine || !ready) return;

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
  }, [isMine, ready, events, getCurrentTime, startedAt, playSound]);
}
