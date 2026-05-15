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
 *
 * C9b：events 不再由 SSR 传 prop，组件挂载时 fetch /api/scores/[id]/events，
 * 避免 events_data 大 JSON 阻塞首屏 HTML 输出。
 */
export default function ScorePlayer({
  scoreId,
  track,
  eventCount,
}: {
  scoreId: string;
  track: Track;
  eventCount: number;
}) {
  const { toggle, playing, currentTrack, getCurrentTime, startedAt, duration } =
    usePlayer();

  const [events, setEvents] = useState<KeyEvent[]>([]);
  const [eventsState, setEventsState] = useState<'loading' | 'ready' | 'error'>(
    eventCount > 0 ? 'loading' : 'ready',
  );

  useEffect(() => {
    if (eventCount === 0) return;
    let cancelled = false;
    fetch(`/api/scores/${scoreId}/events`)
      .then((res) => {
        if (!res.ok) throw new Error(`events fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: { events: KeyEvent[] }) => {
        if (cancelled) return;
        setEvents(Array.isArray(data.events) ? data.events : []);
        setEventsState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ScorePlayer] events fetch failed:', err);
        setEventsState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [scoreId, eventCount]);

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

  if (!track.audio_url || eventCount === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-6 text-center text-sm text-white/40">
        无事件数据
      </div>
    );
  }

  if (eventsState === 'error') {
    return (
      <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-6 text-center text-sm text-red-200/80">
        事件数据加载失败，请稍后刷新重试。
      </div>
    );
  }

  const disabled = eventsState === 'loading';

  return (
    <button
      type="button"
      onClick={() => toggle(track)}
      disabled={disabled}
      className="group flex h-[360px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-white/15 bg-white/[0.03] transition hover:border-white/30 hover:bg-white/[0.06] disabled:cursor-progress disabled:opacity-60 disabled:hover:border-white/15 disabled:hover:bg-white/[0.03]"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 text-2xl text-white/70 transition group-hover:border-white/40 group-hover:text-white">
        {isPlayingThis ? '⏸' : '▶'}
      </span>
      <span className="text-sm text-white/50">
        {eventCount} 个音符 ·{' '}
        {disabled ? '加载中…' : isPlayingThis ? '点击暂停' : '点击播放'}
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
