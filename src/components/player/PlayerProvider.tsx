'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Track } from '@/src/types/tracks';

interface PlayerState {
  playing: boolean;
  currentTrack: Track | null;
  toggle: (track: Track) => Promise<void>;
  stop: () => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

/**
 * PlayerProvider — 全局音频状态
 * 包在 Providers 里，任何组件都能通过 usePlayer() 共享同一个播放状态
 * 💭 为什么不直接用 useAudioPlayer：多个 Island 各自调用会创建独立状态，无法共享
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(async (track: Track) => {
    const ctx = getContext();

    // 停掉上一首
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }

    const res = await fetch(track.audio_url);
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setPlaying(false);
      setCurrentTrack(null);
    };
    source.start();

    sourceRef.current = source;
    setCurrentTrack(track);
    setPlaying(true);
  }, [getContext]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setCurrentTrack(null);
    setPlaying(false);
  }, []);

  const toggle = useCallback(async (track: Track) => {
    if (playing && currentTrack?.id === track.id) {
      stop();
    } else {
      await play(track);
    }
  }, [playing, currentTrack, play, stop]);

  return (
    <PlayerContext value={{ playing, currentTrack, toggle, stop }}>
      {children}
    </PlayerContext>
  );
}

/** 消费全局播放状态的 hook */
export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer 必须在 PlayerProvider 内使用');
  }
  return ctx;
}
