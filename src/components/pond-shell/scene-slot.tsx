'use client';

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react';
import type { GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import type { Track36VisitorState } from '@/src/components/pond-gl-test3/visitor/track36-state';
import { getScenePresence } from './motion/scene-presence';

export type PondSceneDescriptor = {
  owner: 'score' | 'tracks';
  sceneContent?: ReactNode;
  flags: GLFlags;
  glSim?: GlSim;
  visitor?: RefObject<Track36VisitorState | null>;
  scenePresence?: RefObject<number>;
  pointerInteractive?: boolean;
  onPerformanceChange?: (degraded: boolean) => void;
};

type SlotValue = {
  scene: PondSceneDescriptor | null;
  scenes: Partial<Record<PondSceneDescriptor['owner'], PondSceneDescriptor>>;
  health: GlHealth;
  sceneReady: boolean;
  register: (scene: PondSceneDescriptor) => void;
  unregister: (scene: PondSceneDescriptor) => void;
  reportCore: (health: GlHealth, ready: boolean) => void;
};

const PondSceneSlotContext = createContext<SlotValue | null>(null);

export function PondSceneSlotProvider({ children }: { children: ReactNode }) {
  const [scene, setScene] = useState<PondSceneDescriptor | null>(null);
  const [scenes, setScenes] = useState<SlotValue['scenes']>({});
  const [health, setHealth] = useState<GlHealth>('unavailable');
  const [sceneReady, setSceneReady] = useState(false);
  const sceneRef = useRef<PondSceneDescriptor | null>(null);
  const leavingFrames = useRef(new Map<PondSceneDescriptor['owner'], number>());
  const register = useCallback((next: PondSceneDescriptor) => {
    cancelAnimationFrame(leavingFrames.current.get(next.owner) ?? 0);
    leavingFrames.current.delete(next.owner);
    sceneRef.current = next;
    setScene(next);
    setScenes(current => current[next.owner] === next ? current : { ...current, [next.owner]: next });
  }, []);
  const unregister = useCallback((leaving: PondSceneDescriptor) => {
    cancelAnimationFrame(leavingFrames.current.get(leaving.owner) ?? 0);
    const finish = () => {
      if (getScenePresence(leaving.owner) > 0) {
        leavingFrames.current.set(leaving.owner, requestAnimationFrame(finish)); return;
      }
      leavingFrames.current.delete(leaving.owner);
      if (sceneRef.current === leaving) sceneRef.current = null;
      setScene((current) => current === leaving ? null : current);
      setScenes(current => {
        if (current[leaving.owner] !== leaving) return current;
        const next = { ...current }; delete next[leaving.owner]; return next;
      });
    };
    finish();
  }, []);
  useEffect(() => { const frames = leavingFrames.current; return () => frames.forEach(cancelAnimationFrame); }, []);
  const reportCore = useCallback((nextHealth: GlHealth, ready: boolean) => {
    setHealth(nextHealth);
    setSceneReady(ready);
  }, []);
  const value = useMemo(() => ({
    scene, scenes, health, sceneReady, register, unregister, reportCore,
  }), [health, register, reportCore, scene, scenes, sceneReady, unregister]);
  return <PondSceneSlotContext.Provider value={value}>{children}</PondSceneSlotContext.Provider>;
}

export function usePondSceneSlot() {
  const context = useContext(PondSceneSlotContext);
  if (!context) throw new Error('Pond SceneSlot 必须位于 PersistentPondShell 内');
  return context;
}

export function useOptionalPondSceneSlot() {
  return useContext(PondSceneSlotContext);
}

/** descriptor 更新原子替换；只有真正卸载时才注销当前实例。 */
export function useRegisterPondScene(scene: PondSceneDescriptor, enabled = true) {
  const { register, unregister, health, sceneReady } = usePondSceneSlot();
  const latest = useRef(scene);
  useLayoutEffect(() => {
    latest.current = scene;
    if (enabled) register(scene);
    else unregister(scene);
  }, [enabled, register, scene, unregister]);
  useLayoutEffect(() => () => unregister(latest.current), [unregister]);
  return { health, sceneReady };
}
