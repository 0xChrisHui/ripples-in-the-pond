'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { WalletRecipePlayerEngine } from '@/src/features/wallet-recipe/player/engine';
import type { FeaturedEcho } from '@/src/types/featured-echo';

export type FeaturedEchoPlayback = {
  active: boolean;
  playing: boolean;
  paused: boolean;
  progress: number;
  positionMs: number;
  durationMs: number;
  state: ReturnType<WalletRecipePlayerEngine['getSnapshot']>['state'];
  errorMessage: string | null;
  toggle: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  retry: () => Promise<void>;
  stop: () => void;
};

/** ECHO 首次点击才下载永久片段；与普通 Track 播放严格互斥。 */
export function useFeaturedEchoPlayback(echo: FeaturedEcho | null): FeaturedEchoPlayback {
  const [engine] = useState(() => new WalletRecipePlayerEngine());
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getServerSnapshot);
  const { stop: stopRegular, subscribe } = usePlayer();
  const operationRef = useRef(0);
  const active = !['idle', 'ended', 'error'].includes(snapshot.state);

  const stop = useCallback(() => {
    operationRef.current += 1;
    void engine.destroy();
  }, [engine]);

  const pause = useCallback(() => engine.pause(), [engine]);
  const resume = useCallback(async () => {
    stopRegular();
    await engine.resume();
  }, [engine, stopRegular]);

  const start = useCallback(async () => {
    if (!echo) return;
    const operation = ++operationRef.current;
    stopRegular();
    await engine.load({ recipe: echo.recipe, clips: echo.clips });
    if (operation === operationRef.current && engine.getSnapshot().state === 'ready') {
      await engine.play();
    }
  }, [echo, engine, stopRegular]);

  const toggle = useCallback(async () => {
    if (!echo) return;
    if (snapshot.state === 'playing') {
      pause();
      return;
    }
    if (snapshot.state === 'paused') {
      await resume();
      return;
    }
    if (snapshot.state === 'loading') {
      stop();
      return;
    }
    stopRegular();
    if (snapshot.state === 'ended') {
      await engine.replay();
      return;
    }
    if (snapshot.state === 'ready') await engine.play();
    else await start();
  }, [echo, engine, pause, resume, snapshot.state, start, stop, stopRegular]);

  useEffect(() => {
    return subscribe({
      onBeforePlay: () => {
        const state = engine.getSnapshot().state;
        if (!['idle', 'ended', 'error'].includes(state)) stop();
      },
    });
  }, [engine, stop, subscribe]);
  useEffect(() => {
    if (!echo) stop();
  }, [echo, stop]);
  useEffect(() => () => {
    operationRef.current += 1;
    void engine.destroy();
  }, [engine]);

  return {
    active,
    playing: snapshot.state === 'playing',
    paused: snapshot.state === 'paused',
    progress: snapshot.durationMs > 0 ? snapshot.positionMs / snapshot.durationMs : 0,
    positionMs: snapshot.positionMs,
    durationMs: snapshot.durationMs || echo?.durationMs || 0,
    state: snapshot.state,
    errorMessage: snapshot.errorMessage,
    toggle,
    pause,
    resume,
    retry: start,
    stop,
  };
}
