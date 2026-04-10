'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from './PlayerProvider';

/** 秒 → "m:ss" */
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * BottomPlayer — 固定底部播放条 + 进度条
 * 没播放时隐藏，播放时滑入显示曲名 + 进度 + 停止按钮
 */
export default function BottomPlayer() {
  const { playing, currentTrack, duration, startedAt, stop, getCurrentTime } =
    usePlayer();
  const [progress, setProgress] = useState(0);

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

  if (!currentTrack) return null;

  const elapsed = progress * duration;

  return (
    <div
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'flex flex-col',
        'bg-black/80 backdrop-blur-md border-t border-white/10',
        'transition-transform duration-300',
        playing ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
    >
      {/* 进度条 */}
      <div className="h-0.5 w-full bg-white/10">
        <div
          className="h-full bg-white/40 transition-[width] duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
          <div>
            <p className="text-sm text-white">{currentTrack.title}</p>
            <p className="text-xs text-white/40">
              {formatTime(elapsed)} / {formatTime(duration)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={stop}
          className="text-white/60 hover:text-white transition-colors text-sm"
          aria-label="停止播放"
        >
          ⏸ 停止
        </button>
      </div>
    </div>
  );
}
