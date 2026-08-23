'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface UseJamReturn {
  /** 本地 MP3 ArrayBuffer 已下载完毕 */
  ready: boolean;
  /** A13: AudioBuffer 已解码完毕，可安全开始事件时钟 */
  decodeReady: boolean;
  playSound: (key: string) => void;
  /** A13: 主动触发解码（useEventsPlayback 在播放开始时调用，避免懒触发延迟）*/
  triggerDecode: () => void;
}

const LOCAL_SOUND_KEYS = [...'abcdefghijklmnopqrstuvwxyz', 'space', ...'345678'];
const LOCAL_SOUND_FILES = LOCAL_SOUND_KEYS.map((key) => [key, `/sounds/${key}.mp3`] as const);

/**
 * 合奏音效引擎 — 预加载 33 个本地 MP3，按键即播放
 *
 * 核心设计：
 * 1. 页面加载时只 fetch mp3 为 ArrayBuffer（纯网络 IO，无需 AudioContext）
 * 2. 首次按键时才创建 AudioContext + 批量 decodeAudioData
 * 3. 每次按键创建新的 BufferSource，同一键可重叠播放
 */
export function useJam(): UseJamReturn {
  const [ready, setReady] = useState(false);
  const [decodeReady, setDecodeReady] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  // 阶段 1：存原始 ArrayBuffer（页面加载时填充）
  const rawRef = useRef<Map<string, ArrayBuffer>>(new Map());
  // 阶段 2：存解码后的 AudioBuffer（首次按键时填充）
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  // 解码状态机：idle → decoding → decoded；失败回 idle 允许重试
  const decodeStateRef = useRef<'idle' | 'decoding' | 'decoded'>('idle');
  // 解码期间排队的按键，完成后批量重放
  const pendingKeysRef = useRef<string[]>([]);

  // 页面加载：按固定映射下载本地 MP3 为 ArrayBuffer
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const entries = await Promise.all(
        LOCAL_SOUND_FILES.map(async ([key, url]) => {
          const res = await fetch(url);
          const ab = await res.arrayBuffer();
          return [key, ab] as const;
        }),
      );

      if (cancelled) return;
      rawRef.current = new Map(entries);
      setReady(true);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /** 播放单个已解码的音效 */
  const playSingle = useCallback((key: string) => {
    const buffer = buffersRef.current.get(key);
    if (!buffer) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }, []);

  /** 首次按键时：创建 AudioContext + 解码，完成后重放排队的键 */
  const ensureDecoded = useCallback(async () => {
    if (decodeStateRef.current !== 'idle') return;
    decodeStateRef.current = 'decoding';

    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;

      const entries = await Promise.all(
        Array.from(rawRef.current.entries()).map(async ([key, ab]) => {
          const buf = await ctx.decodeAudioData(ab.slice(0));
          return [key, buf] as const;
        }),
      );
      buffersRef.current = new Map(entries);
      decodeStateRef.current = 'decoded';
      setDecodeReady(true);

      // 重放解码期间排队的按键
      for (const k of pendingKeysRef.current) playSingle(k);
      pendingKeysRef.current = [];
    } catch (err) {
      console.error('[useJam] 音效解码失败，可重试', err);
      decodeStateRef.current = 'idle';
      pendingKeysRef.current = [];
    }
  }, [playSingle]);

  const playSound = useCallback((key: string) => {
    if (decodeStateRef.current === 'decoded') {
      playSingle(key);
      return;
    }
    // 解码中或即将开始：排队
    pendingKeysRef.current.push(key);
    if (decodeStateRef.current === 'idle') ensureDecoded();
  }, [playSingle, ensureDecoded]);

  // 清理 AudioContext
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  // A13: 主动触发解码，供 useEventsPlayback 在播放开始时调用（避免第一次 playSound 才懒触发）
  const triggerDecode = useCallback(() => {
    if (decodeStateRef.current === 'idle') ensureDecoded();
  }, [ensureDecoded]);

  return { ready, decodeReady, playSound, triggerDecode };
}
