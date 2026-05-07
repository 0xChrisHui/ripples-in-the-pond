'use client';

import { useEffect, useState } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { useEventsPlayback } from '@/src/hooks/useEventsPlayback';
import type { Track } from '@/src/types/tracks';
import type { KeyEvent } from '@/src/types/jam';

/**
 * ScorePlayer — 唱片详情页播放控件（B8 重设：前端 inline 替代 Arweave decoder iframe）
 *
 * 视觉：360px 高大方块，未播显示中央 ▶ + 音符数；播中显示中央 ⏸ + 进度条。
 * 行为：toggle PlayerProvider 播底曲（BottomPlayer 全局也会同步显示）+
 *      useEventsPlayback 按 events.time 触发音效（用户在录制时的同款时序）。
 */
export default function ScorePlayer({
  track,
  events,
  eventCount,
}: {
  track: Track;
  events: KeyEvent[];
  eventCount: number;
}) {
  const { toggle, playing, currentTrack, getCurrentTime, startedAt, duration } =
    usePlayer();
  useEventsPlayback({ events, trackId: track.id });

  const isPlayingThis = playing && currentTrack?.id === track.id;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const tick = () => {
      if (!isPlayingThis || duration === 0) {
        setProgress(0);
        return;
      }
      const elapsed = getCurrentTime() - startedAt;
      setProgress(Math.min(elapsed / duration, 1));
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isPlayingThis, duration, startedAt, getCurrentTime]);

  if (!track.audio_url || events.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-6 text-center text-sm text-white/40">
        无事件数据
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(track)}
      className="group flex h-[360px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-white/15 bg-white/[0.03] transition hover:border-white/30 hover:bg-white/[0.06]"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 text-2xl text-white/70 transition group-hover:border-white/40 group-hover:text-white">
        {isPlayingThis ? '⏸' : '▶'}
      </span>
      <span className="text-sm text-white/50">
        {eventCount} 个音符 · {isPlayingThis ? '点击暂停' : '点击播放'}
      </span>
      {isPlayingThis && (
        <div className="mt-2 h-0.5 w-3/4 bg-white/10">
          <div
            className="h-full bg-white/40 transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </button>
  );
}
