'use client';

import { useAudioPlayer } from '@/src/hooks/useAudioPlayer';

/**
 * Island — 呼吸圆组件
 * 点击播放/停止音频，播放时呼吸动画加速
 */
export default function Island() {
  const { playing, toggle } = useAudioPlayer();

  return (
    <button
      type="button"
      onClick={() => toggle('/tracks/001.mp3')}
      className={[
        'h-40 w-40 rounded-full bg-blue-500/30 backdrop-blur-sm',
        'transition-shadow duration-700',
        'hover:shadow-[0_0_40px_rgba(59,130,246,0.4)]',
        'focus:outline-none',
        playing ? 'animate-pulse' : 'animate-[pulse_4s_ease-in-out_infinite]',
      ].join(' ')}
      aria-label={playing ? '停止播放' : '播放音乐'}
    />
  );
}
