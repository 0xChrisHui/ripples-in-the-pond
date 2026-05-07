'use client';

import { useMintScore } from '@/src/hooks/useMintScore';
import { useEventsPlayback } from '@/src/hooks/useEventsPlayback';
import { usePlayer } from '@/src/components/player/PlayerProvider';
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
}: {
  title: string;
  pendingScoreId?: string;
  track?: Track;
  events?: KeyEvent[];
}) {
  const { state: clientState, mint } = useMintScore();
  const { toggle, playing, currentTrack } = usePlayer();

  // hook 必须无条件调用 — track 缺失时传 '' 让 useEventsPlayback 内部 noop
  useEventsPlayback({ events: events ?? [], trackId: track?.id ?? '' });

  const canPlay = !!track && !!events && events.length > 0;
  const isPlayingThis = playing && !!track && currentTrack?.id === track.id;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>

      <div className="mt-3 flex items-center justify-between">
        {canPlay ? (
          <button
            type="button"
            onClick={() => toggle(track)}
            className="text-base text-white/60 transition-colors hover:text-white"
            aria-label={isPlayingThis ? '暂停' : '播放'}
          >
            {isPlayingThis ? '⏸' : '▶'}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        {!pendingScoreId ? (
          <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-white/30">
            上传中...
          </span>
        ) : clientState === 'queued' ? (
          <span className="text-xs text-white/80">铸造中...</span>
        ) : clientState === 'success' ? (
          <span className="text-xs text-emerald-400/90">铸造成功 ✓</span>
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
