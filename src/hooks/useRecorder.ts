'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import type { KeyEvent } from '@/src/types/jam';

/** 录制上限 */
const MAX_DURATION_MS = 60_000;
const MAX_EVENTS = 500;

interface UseRecorderOptions {
  /** 录制完成时的回调 */
  onComplete?: (result: RecordingResult) => void;
}

interface UseRecorderReturn {
  /** 当前是否在录制 */
  recording: boolean;
  /** 记录一次按键（传给 useKeyboard 的 onKeyDown） */
  recordKeyDown: (key: string) => void;
  /** 记录按键抬起（传给 useKeyboard 的 onKeyUp） */
  recordKeyUp: (key: string) => void;
}

export interface RecordingResult {
  trackId: string;
  events: KeyEvent[];
}

/**
 * 录制 hook — 绑定 PlayerProvider 生命周期
 *
 * 播放开始 → 自动开始录制（console 提示）
 * 播放结束 / 超时 / 超事件数 → 自动停止录制（console 输出事件）
 * 没播放时按键 → 不录制
 *
 * 时间基准：performance.now() 相对于录制开始时间的偏移（毫秒）
 * （playbook 写 AudioContext.currentTime，但音效用独立 ctx，
 *   背景曲用 PlayerProvider 的 ctx，两者不共享。
 *   用 performance.now() 更简单且精度足够）
 */
export function useRecorder(options: UseRecorderOptions = {}): UseRecorderReturn {
  const { subscribe } = usePlayer();
  const [recording, setRecording] = useState(false);

  const startTimeRef = useRef(0);
  const eventsRef = useRef<KeyEvent[]>([]);
  const pendingRef = useRef<Map<string, number>>(new Map());
  const trackIdRef = useRef('');
  const recordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(options.onComplete);
  useEffect(() => { onCompleteRef.current = options.onComplete; }, [options.onComplete]);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 把还没抬起的键强制结束
    const now = performance.now();
    pendingRef.current.forEach((downTime, key) => {
      eventsRef.current.push({
        key,
        time: Math.round(downTime - startTimeRef.current),
        duration: Math.round(now - downTime),
      });
    });
    pendingRef.current.clear();

    const result: RecordingResult = {
      trackId: trackIdRef.current,
      events: [...eventsRef.current],
    };

    console.log(
      `[recorder] 录制结束：${result.events.length} 个事件`,
      result.events,
    );
    onCompleteRef.current?.(result);
  }, []);

  const startRecording = useCallback((trackId: string) => {
    eventsRef.current = [];
    pendingRef.current.clear();
    startTimeRef.current = performance.now();
    trackIdRef.current = trackId;
    recordingRef.current = true;
    setRecording(true);

    // 60 秒超时自动停止
    timerRef.current = setTimeout(stopRecording, MAX_DURATION_MS);
    console.log('[recorder] 录制开始');
  }, [stopRecording]);

  // 订阅播放生命周期
  useEffect(() => {
    const unsub = subscribe({
      onPlayStart: (track) => startRecording(track.id),
      onPlayEnd: () => stopRecording(),
    });
    return unsub;
  }, [subscribe, startRecording, stopRecording]);

  const recordKeyDown = useCallback((key: string) => {
    if (!recordingRef.current) return;
    if (eventsRef.current.length >= MAX_EVENTS) {
      stopRecording();
      return;
    }
    pendingRef.current.set(key, performance.now());
  }, [stopRecording]);

  const recordKeyUp = useCallback((key: string) => {
    if (!recordingRef.current) return;
    const downTime = pendingRef.current.get(key);
    if (downTime === undefined) return;
    pendingRef.current.delete(key);

    const now = performance.now();
    eventsRef.current.push({
      key,
      time: Math.round(downTime - startTimeRef.current),
      duration: Math.round(now - downTime),
    });
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { recording, recordKeyDown, recordKeyUp };
}
