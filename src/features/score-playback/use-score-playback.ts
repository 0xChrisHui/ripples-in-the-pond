'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ScorePlaybackEngine } from './engine';
import { requestPlaybackFocus, subscribePlaybackFocus } from '@/src/components/player/playback-focus';
import type { ScorePlaybackBootstrap, UseScorePlaybackResult } from './types';

/** 页面只消费状态和动作；AudioContext 仍要等用户调用 play/toggle 才创建。 */
export function useScorePlayback(
  bootstrap: ScorePlaybackBootstrap | null,
): UseScorePlaybackResult {
  const [engine] = useState(() => new ScorePlaybackEngine());
  const prepared = useRef<ScorePlaybackBootstrap | null>(null);
  const [requested, setRequested] = useState<ScorePlaybackBootstrap | null>(null);
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );

  useEffect(() => {
    prepared.current = null;
    return () => { prepared.current = null; void engine.destroy(); };
  }, [bootstrap, engine]);

  // load与play在同一个点击调用栈启动，让AudioContext保留手机浏览器的手势授权。
  const prepare = () => {
    if (!bootstrap) return false;
    if (prepared.current !== bootstrap) {
      prepared.current = bootstrap; setRequested(bootstrap); void engine.load(bootstrap);
    }
    return true;
  };

  const pause = () => {
    if (engine.getSnapshot().playRequested) void engine.toggle();
    else engine.pause();
  };
  useEffect(() => subscribePlaybackFocus(engine, () => {
    if (engine.getSnapshot().playRequested) void engine.toggle();
    else engine.pause();
  }), [engine]);
  const play = () => {
    if (!prepare()) return Promise.resolve();
    requestPlaybackFocus(engine);
    return engine.play();
  };

  return {
    ...snapshot,
    ...(bootstrap && requested !== bootstrap ? { state: 'ready' as const, playRequested: false } : {}),
    play,
    pause,
    seek: (positionMs) => engine.seek(positionMs),
    toggle: () => {
      const state = engine.getSnapshot();
      if (state.state !== 'playing' && !state.playRequested) {
        if (!prepare()) return Promise.resolve();
        requestPlaybackFocus(engine);
      }
      return engine.toggle();
    },
    replay: () => { requestPlaybackFocus(engine); return engine.replay(); },
  };
}
