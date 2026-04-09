'use client';

import { usePlayer } from './PlayerProvider';

/**
 * BottomPlayer — 固定底部播放条
 * 没播放时隐藏，播放时滑入显示曲名 + 暂停按钮
 */
export default function BottomPlayer() {
  const { playing, currentTrack, stop } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'flex items-center justify-between px-6 py-3',
        'bg-black/80 backdrop-blur-md border-t border-white/10',
        'transition-transform duration-300',
        playing ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
        <div>
          <p className="text-sm text-white">{currentTrack.title}</p>
          <p className="text-xs text-white/40">{currentTrack.island}</p>
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
  );
}
