'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { fetchSounds } from '@/src/data/jam-source';
import type { Sound } from '@/src/types/jam';

interface UseJamReturn {
  /** 26 个音效数据 */
  sounds: Sound[];
  /** 是否加载完成 */
  ready: boolean;
  /** 按键触发音效 — 传给 useKeyboard 的 onKeyDown */
  playSound: (key: string) => void;
}

/**
 * 合奏音效引擎 — 预加载 26 个音效为 AudioBuffer，按键即播放
 *
 * 核心设计：
 * 1. AudioContext 在第一次 playSound 调用时创建（用户手势内）
 * 2. 预加载所有 mp3 为 AudioBuffer，避免播放时 fetch 造成延迟
 * 3. 每次按键创建新的 BufferSource，同一键可重叠播放
 */
export function useJam(): UseJamReturn {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [ready, setReady] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  // 加载音效数据 + 预加载 AudioBuffer
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const list = await fetchSounds();
      if (cancelled) return;
      setSounds(list);

      // 创建临时 context 仅用于解码（不播放，不违反手势要求）
      const decodeCtx = new AudioContext();
      const entries = await Promise.all(
        list.map(async (s) => {
          const res = await fetch(s.audio_url);
          const buf = await decodeCtx.decodeAudioData(await res.arrayBuffer());
          return [s.key, buf] as const;
        }),
      );
      // 解码完关掉临时 context
      await decodeCtx.close();

      if (cancelled) return;
      buffersRef.current = new Map(entries);
      setReady(true);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const playSound = useCallback((key: string) => {
    const buffer = buffersRef.current.get(key);
    if (!buffer) return;

    const ctx = getContext();
    // 如果 context 被挂起（浏览器策略），在用户手势中恢复
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }, [getContext]);

  // 清理 AudioContext
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return { sounds, ready, playSound };
}
