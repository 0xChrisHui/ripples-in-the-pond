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

/** 播放生命周期回调（B2 录制用） */
export interface PlayerLifecycle {
  onPlayStart?: (track: Track) => void;
  onPlayEnd?: () => void;
}

interface PlayerState {
  playing: boolean;
  currentTrack: Track | null;
  duration: number;
  /** 播放开始时的 audio.currentTime（一般为 0；中途 resume 不为 0） */
  startedAt: number;
  toggle: (track: Track) => Promise<void>;
  stop: () => void;
  subscribe: (lifecycle: PlayerLifecycle) => () => void;
  /** 当前 audio.currentTime（秒） */
  getCurrentTime: () => number;
}

const PlayerContext = createContext<PlayerState | null>(null);

/**
 * PlayerProvider — 全局播放器（Phase 6 B2.1 v6 改用 HTMLAudio 实现首次秒开）
 *
 * vs 旧版（Web Audio + decode）的区别：
 * - HTMLAudio.play() 几乎瞬时（streaming 边加载边播）→ 解决"首次 0.8s 延迟"
 * - getCurrentTime / startedAt / duration 接口保持兼容（BottomPlayer + useRecorder 在用）
 * - HomeJam 的 useJam 仍用 Web Audio（精确合奏不受影响）
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [duration, setDuration] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const listenersRef = useRef<Set<PlayerLifecycle>>(new Set());

  const subscribe = useCallback((lifecycle: PlayerLifecycle) => {
    listenersRef.current.add(lifecycle);
    return () => { listenersRef.current.delete(lifecycle); };
  }, []);

  const notifyStart = useCallback((track: Track) => {
    listenersRef.current.forEach((l) => l.onPlayStart?.(track));
  }, []);

  const notifyEnd = useCallback(() => {
    listenersRef.current.forEach((l) => l.onPlayEnd?.());
  }, []);

  // lazy 创建 + 绑事件（loadedmetadata 拿 duration / ended reset state）
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('loadedmetadata', () => {
        if (audioRef.current === audio) setDuration(audio.duration || 0);
      });
      audio.addEventListener('ended', () => {
        if (audioRef.current === audio) {
          setPlaying(false);
          setCurrentTrack(null);
          setDuration(0);
          setStartedAt(0);
          notifyEnd();
        }
      });
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [notifyEnd]);

  const play = useCallback(async (track: Track) => {
    if (loadingRef.current === track.id) return;
    loadingRef.current = track.id;

    const audio = getAudio();
    audio.pause();
    audio.src = track.audio_url;

    // 乐观 UI：立即变 playing（HTMLAudio 真正出声 < 100ms 通常体感即时）
    setCurrentTrack(track);
    setPlaying(true);
    setStartedAt(audio.currentTime || 0);
    setDuration(audio.duration || 0);
    notifyStart(track);

    try {
      await audio.play();
    } catch (err) {
      if (loadingRef.current === track.id) loadingRef.current = null;
      console.error('[player] play failed', { trackId: track.id, err });
      setPlaying(false);
      setCurrentTrack(null);
      return;
    }

    // 加载期间用户切到别的（loadingRef 被覆盖）→ 当前 audio 已被新 src 覆盖，无需手动停
    if (loadingRef.current !== track.id) return;
    if (loadingRef.current === track.id) loadingRef.current = null;
  }, [getAudio, notifyStart]);

  const stop = useCallback(() => {
    loadingRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTrack(null);
    setPlaying(false);
    setDuration(0);
    setStartedAt(0);
    notifyEnd();
  }, [notifyEnd]);

  const toggle = useCallback(async (track: Track) => {
    if (playing && currentTrack?.id === track.id) {
      stop();
    } else {
      await play(track);
    }
  }, [playing, currentTrack, play, stop]);

  const getCurrentTime = useCallback(() => {
    return audioRef.current?.currentTime ?? 0;
  }, []);

  return (
    <PlayerContext value={{
      playing, currentTrack, duration, startedAt,
      toggle, stop, subscribe, getCurrentTime,
    }}>
      {children}
    </PlayerContext>
  );
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer 必须在 PlayerProvider 内使用');
  }
  return ctx;
}
