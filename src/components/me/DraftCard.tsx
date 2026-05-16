'use client';

import { useState } from 'react';
import { useMintScore } from '@/src/hooks/score/useMintScore';
import { useEventsPlayback } from '@/src/hooks/useEventsPlayback';
import { useAuth } from '@/src/hooks/useAuth';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { fetchMyScoreEvents } from '@/src/data/jam-source';
import type { Track } from '@/src/types/tracks';
import type { KeyEvent } from '@/src/types/jam';

/**
 * DraftCard — 草稿卡片（B8 Phase 2：加 ▶ 迷你播放）
 *
 * 左侧 ▶ 播放按钮（仅 server 草稿，有 track+events 时显示）：
 *   - 点击 → toggle PlayerProvider 播底曲 + BottomPlayer 进度条滑出
 *   - 同时 useEventsPlayback 监听播放状态，按 events.time 触发音效
 *
 * 右侧铸造态 4 选 1（B8 Phase 1）：
 *   - !pendingScoreId       →「上传中...」
 *   - clientState='queued'  →「铸造中...」
 *   - clientState='success' →「铸造成功 ✓」
 *   - 默认                   →「铸造成唱片 NFT」按钮
 */
export default function DraftCard({
  title,
  pendingScoreId,
  track,
  events,
  eventCount,
}: {
  title: string;
  pendingScoreId?: string;
  track?: Track;
  events?: KeyEvent[];
  eventCount?: number;
}) {
  const { getAccessToken } = useAuth();
  const { state: clientState, mint } = useMintScore();
  const { toggle, playing, currentTrack } = usePlayer();
  const [playEvents, setPlayEvents] = useState<KeyEvent[] | null>(events ?? null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);

  // hook 必须无条件调用 — track 缺失时传 '' 让 useEventsPlayback 内部 noop
  useEventsPlayback({ events: playEvents ?? [], trackId: track?.id ?? '' });

  const hasEvents = playEvents ? playEvents.length > 0 : (eventCount ?? 0) > 0;
  const canPlay = !!track && !!pendingScoreId && hasEvents;
  const isPlayingThis = playing && !!track && currentTrack?.id === track.id;

  async function handlePlay() {
    if (!track || !pendingScoreId || eventsLoading) return;
    if (playEvents) {
      toggle(track);
      return;
    }

    setEventsLoading(true);
    setEventsError(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('未登录');
      const loadedEvents = await fetchMyScoreEvents(token, pendingScoreId);
      setPlayEvents(loadedEvents);
      toggle(track);
    } catch (err) {
      console.error('草稿事件加载失败:', err);
      setEventsError(true);
    } finally {
      setEventsLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>

      <div className="mt-3 flex items-center justify-between">
        {canPlay ? (
          <button
            type="button"
            onClick={handlePlay}
            disabled={eventsLoading}
            className="text-base text-white/60 transition-colors hover:text-white disabled:text-white/20"
            aria-label={isPlayingThis ? '暂停' : '播放'}
          >
            {eventsLoading ? '…' : isPlayingThis ? '⏸' : '▶'}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        {eventsError && (
          <span className="text-xs text-red-300/80">播放加载失败</span>
        )}

        {!pendingScoreId ? (
          <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-white/30">
            上传中...
          </span>
        ) : clientState === 'queued' ? (
          <span className="text-xs text-white/80">铸造中...</span>
        ) : clientState === 'success' ? (
          <span className="text-xs text-emerald-400/90">铸造成功 ✓</span>
        ) : clientState === 'error' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-300/80">提交失败，请重试</span>
            <button
              type="button"
              onClick={() => mint(pendingScoreId)}
              className="rounded-full border border-red-300/30 px-3 py-0.5 text-xs text-red-300/80 transition-all hover:bg-red-300/10"
            >
              重试
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => mint(pendingScoreId)}
            className="rounded-full border border-white/40 px-4 py-1 text-xs text-white/90 transition-all hover:bg-white/10"
          >
            铸造成唱片 NFT
          </button>
        )}
      </div>
    </div>
  );
}
