'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ScorePlaybackEngine } from './engine';
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

  return {
    ...snapshot,
    play: () => engine.play(),
    pause: () => engine.pause(),
    seek: (positionMs) => engine.seek(positionMs),
    toggle: () => engine.toggle(),
    replay: () => engine.replay(),
  };
}
