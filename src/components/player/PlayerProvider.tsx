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
  /** 当前曲目总时长（秒） */
  duration: number;
  /** 播放开始的 AudioContext 时间（秒），用于算进度 */
  startedAt: number;
  toggle: (track: Track) => Promise<void>;
  stop: () => void;
  /** 注册播放生命周期回调，返回注销函数 */
  subscribe: (lifecycle: PlayerLifecycle) => () => void;
  /** 获取 AudioContext.currentTime（秒） */
  getCurrentTime: () => number;
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
  /**
   * Phase 6 B4: 拦"快速连点 / 切岛屿"导致的音频叠加
   * - 同 trackId 第二次进入 play → 拒绝（已经在加载）
   * - await 期间 loadingRef 被覆盖（用户切到别的）→ stale 那次 abort
   * - stop() 把 loadingRef 设 null → 加载中的 play 也会被 abort
   */
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

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(async (track: Track) => {
    // Phase 6 B4: 同 trackId 重复点直接拒绝（避免双加载）
    if (loadingRef.current === track.id) return;
    loadingRef.current = track.id;

    const ctx = getContext();

    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
      notifyEnd();
    }

    let buffer: AudioBuffer;
    try {
      const res = await fetch(track.audio_url);
      buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      // 加载失败：仅在仍是自己持有 lock 时清，不覆盖后续调用
      if (loadingRef.current === track.id) loadingRef.current = null;
      console.error('[player] load failed', { trackId: track.id, err });
      return;
    }

    // 加载期间用户切到别的（loadingRef 被覆盖）或 stop（loadingRef = null）→ 放弃 start
    if (loadingRef.current !== track.id) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setPlaying(false);
      setCurrentTrack(null);
      setDuration(0);
      setStartedAt(0);
      notifyEnd();
    };
    source.start();

    sourceRef.current = source;
    setCurrentTrack(track);
    setDuration(buffer.duration);
    setStartedAt(ctx.currentTime);
    setPlaying(true);
    notifyStart(track);

    // start 后释放 lock（仅在仍是自己时；保险起见，更晚的调用可能已覆盖）
    if (loadingRef.current === track.id) loadingRef.current = null;
  }, [getContext, notifyStart, notifyEnd]);

  const stop = useCallback(() => {
    // Phase 6 B4: 把 loadingRef 也清空，让加载中的 play 完成后 abort（不会还 start）
    loadingRef.current = null;
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
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
    return ctxRef.current?.currentTime ?? 0;
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

/** 消费全局播放状态的 hook */
export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer 必须在 PlayerProvider 内使用');
  }
  return ctx;
}
