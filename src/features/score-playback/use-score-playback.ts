'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ScorePlaybackManifest } from '@/src/types/jam';
import { ScorePlaybackEngine } from './engine';
import type { UseScorePlaybackResult } from './types';

/** 页面只消费状态和动作；AudioContext 仍要等用户调用 play/toggle 才创建。 */
export function useScorePlayback(
  manifest: ScorePlaybackManifest | null,
): UseScorePlaybackResult {
  const [engine] = useState(() => new ScorePlaybackEngine());
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );

  useEffect(() => {
    if (manifest) void engine.load(manifest);
    return () => { void engine.destroy(); };
  }, [engine, manifest]);

  return {
    ...snapshot,
    play: () => engine.play(),
    pause: () => engine.pause(),
    toggle: () => engine.toggle(),
    replay: () => engine.replay(),
  };
}
