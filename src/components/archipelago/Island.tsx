'use client';

import type { Track } from '@/src/types/tracks';
import { usePlayer } from '@/src/components/player/PlayerProvider';

/** 颜色 → Tailwind class 映射 */
const COLOR_MAP: Record<string, { bg: string; glow: string }> = {
  blue: {
    bg: 'bg-blue-500/30',
    glow: 'hover:shadow-[0_0_40px_rgba(59,130,246,0.4)]',
  },
  emerald: {
    bg: 'bg-emerald-500/30',
    glow: 'hover:shadow-[0_0_40px_rgba(16,185,129,0.4)]',
  },
  violet: {
    bg: 'bg-violet-500/30',
    glow: 'hover:shadow-[0_0_40px_rgba(139,92,246,0.4)]',
  },
  amber: {
    bg: 'bg-amber-500/30',
    glow: 'hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]',
  },
  rose: {
    bg: 'bg-rose-500/30',
    glow: 'hover:shadow-[0_0_40px_rgba(244,63,94,0.4)]',
  },
};

const DEFAULT_COLOR = { bg: 'bg-white/20', glow: '' };

/**
 * Island — 单个岛屿
 * 接收 Track 数据，点击播放/停止对应音频
 */
export default function Island({ track }: { track: Track }) {
  const { playing, currentTrack, toggle } = usePlayer();
  const isActive = playing && currentTrack?.id === track.id;
  const colors = COLOR_MAP[track.cover] ?? DEFAULT_COLOR;

  return (
    <button
      type="button"
      onClick={() => toggle(track)}
      className={[
        'flex flex-col items-center gap-3 group',
        'focus:outline-none',
      ].join(' ')}
      aria-label={isActive ? `停止播放 ${track.title}` : `播放 ${track.title}`}
    >
      <div
        className={[
          'h-28 w-28 rounded-full backdrop-blur-sm',
          'transition-shadow duration-700',
          colors.bg,
          colors.glow,
          isActive
            ? 'animate-pulse shadow-lg'
            : 'animate-[pulse_4s_ease-in-out_infinite]',
        ].join(' ')}
      />
      <span
        className={[
          'text-xs tracking-wide transition-opacity duration-300',
          isActive ? 'text-white opacity-100' : 'text-white/50 opacity-70',
          'group-hover:opacity-100',
        ].join(' ')}
      >
        {track.title}
      </span>
    </button>
  );
}
