'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { WalletRecipePlayerEngine } from './engine';
import type { WalletRecipePlayerInput } from './types';

/** 页面只负责提供已严格校验的永久 metadata；hook 不会自动播放或创建 AudioContext。 */
export function useWalletRecipePlayer(input: WalletRecipePlayerInput | null) {
  const [engine] = useState(() => new WalletRecipePlayerEngine());
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getServerSnapshot,
  );

  useEffect(() => {
    if (input) void engine.load(input);
    else void engine.destroy();
    return () => { void engine.destroy(); };
  }, [engine, input]);

  return {
    ...snapshot,
    play: engine.play.bind(engine),
    pause: engine.pause.bind(engine),
    resume: engine.resume.bind(engine),
    seek: engine.seek.bind(engine),
    replay: engine.replay.bind(engine),
    retryLoad: () => input ? engine.load(input) : Promise.resolve(),
  };
}
