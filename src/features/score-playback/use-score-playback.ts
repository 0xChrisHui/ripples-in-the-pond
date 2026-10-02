'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ScorePlaybackEngine } from './engine';
import { requestPlaybackFocus, subscribePlaybackFocus } from '@/src/components/player/playback-focus';
import type { ScorePlaybackBootstrap, UseScorePlaybackResult } from './types';

/** 页面只消费状态和动作；AudioContext 仍要等用户调用 play/toggle 才创建。 */
export function useScorePlayback(
  bootstrap: ScorePlaybackBootstrap | null,
): UseScorePlaybackResult {
  const [engine] = useState(() => new ScorePlaybackEngine());
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );

  useEffect(() => {
    if (bootstrap) void engine.load(bootstrap);
    return () => { void engine.destroy(); };
  }, [bootstrap, engine]);

  const pause = () => {
    if (engine.getSnapshot().playRequested) void engine.toggle();
    else engine.pause();
  };
  useEffect(() => subscribePlaybackFocus(engine, () => {
    if (engine.getSnapshot().playRequested) void engine.toggle();
    else engine.pause();
  }), [engine]);
  const play = () => {
    requestPlaybackFocus(engine);
    return engine.play();
  };

  return {
    ...snapshot,
    play,
    pause,
    seek: (positionMs) => engine.seek(positionMs),
    toggle: () => {
      const state = engine.getSnapshot();
      if (state.state !== 'playing' && !state.playRequested) requestPlaybackFocus(engine);
      return engine.toggle();
    },
    replay: () => { requestPlaybackFocus(engine); return engine.replay(); },
  };
}
