'use client';

import type { FeaturedEcho } from '@/src/types/featured-echo';
import type { FeaturedEchoPlayback } from './useFeaturedEchoPlayback';

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Pond Echo 专用控制条；它不是 Material Track，因此永远不显示收藏。 */
export default function FeaturedEchoBottomPlayer({
  echo,
  playback,
}: {
  echo: FeaturedEcho | null;
  playback: FeaturedEchoPlayback;
}) {
  if (!echo || playback.state === 'idle') return null;
  const action = playback.state === 'playing' ? '暂停'
    : playback.state === 'paused' ? '继续'
      : playback.state === 'ended' ? '重新播放'
        : playback.state === 'error' ? '重试' : '取消加载';
  return (
    <aside className="bottom-player-shell" data-playing={playback.playing}
      data-featured-echo-player={playback.state} aria-label="Pond Echo 播放器">
      <div className="bottom-player">
        <div className="bottom-player__progress" role="progressbar" aria-label="播放进度"
          aria-valuemin={0} aria-valuemax={Math.max(1, playback.durationMs)}
          aria-valuenow={Math.round(playback.positionMs)}>
          <span style={{ transform: `scaleX(${Math.min(1, playback.progress)})` }} />
        </div>
        <div className="bottom-player__body">
          <span className="bottom-player__record" aria-hidden="true"><span /></span>
          <div className="bottom-player__identity">
            <p title={echo.title}>{echo.title}</p>
            <span>{formatTime(playback.positionMs)} <i aria-hidden="true">/</i> {formatTime(playback.durationMs)}</span>
            {playback.errorMessage && <span role="alert">{playback.errorMessage}</span>}
          </div>
          <div className="bottom-player__actions">
            <button type="button" onClick={() => { void playback.toggle(); }}>{action}</button>
            <button type="button" onClick={playback.stop} aria-label={`停止播放《${echo.title}》`}>停止</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
