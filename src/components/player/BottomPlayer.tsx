'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePlayer } from './PlayerProvider';
import { useFavorite } from '@/src/hooks/useFavorite';
import './bottom-player.css';

/** 秒 → "m:ss" */
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 全局试听的窄唱片标签；Score 路由拥有独立播放会话，因此精确隐藏。 */
export default function BottomPlayer() {
  const pathname = usePathname();
  const { playing, currentTrack, duration, startedAt, stop, getCurrentTime } =
    usePlayer();
  const [progress, setProgress] = useState(0);
  // hooks 不能 conditional，currentTrack null 时用 placeholder（不会触发 favorite()）
  const { status, favorite } = useFavorite(
    currentTrack?.week ?? 0,
    currentTrack?.id ?? '__placeholder__',
  );

  useEffect(() => {
    const tick = () => {
      if (!playing || duration === 0) {
        setProgress(0);
        return;
      }
      const elapsed = getCurrentTime() - startedAt;
      setProgress(Math.min(elapsed / duration, 1));
    };

    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [playing, duration, startedAt, getCurrentTime]);

  if (!currentTrack || pathname.startsWith('/score/')) return null;

  const elapsed = duration > 0 ? progress * duration : 0;

  return (
    <>
      <div className="bottom-player-spacer" aria-hidden="true" />
      <aside
        className="bottom-player-shell"
        data-playing={playing}
        aria-label="全局播放器"
      >
        <div className="bottom-player">
          <div
            className="bottom-player__progress"
            role="progressbar"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={Math.max(1, Math.round(duration))}
            aria-valuenow={Math.round(elapsed)}
            aria-valuetext={`${formatTime(elapsed)} / ${formatTime(duration)}`}
          >
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>

          <div className="bottom-player__body">
            <span className="bottom-player__record" aria-hidden="true">
              <span />
            </span>

            <div className="bottom-player__identity">
              <p title={currentTrack.title}>{currentTrack.title}</p>
              <span>
                {formatTime(elapsed)} <i aria-hidden="true">/</i> {formatTime(duration)}
              </span>
            </div>

            <div className="bottom-player__actions">
              <button
                type="button"
                onClick={favorite}
                data-active={status === 'success'}
                aria-label={status === 'success' ? '已收藏' : `收藏《${currentTrack.title}》`}
              >
                {status === 'success' ? '已收藏' : '收藏'}
              </button>
              <button
                type="button"
                onClick={stop}
                aria-label={`停止播放《${currentTrack.title}》`}
              >
                停止
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
