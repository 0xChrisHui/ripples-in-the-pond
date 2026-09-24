'use client';

import {
  createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react';
import type { GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import type { Track36VisitorState } from '@/src/components/pond-gl-test3/visitor/track36-state';

export type PondSceneDescriptor = {
  owner: 'score';
  flags: GLFlags;
  glSim?: GlSim;
  visitor?: RefObject<Track36VisitorState | null>;
  pointerInteractive?: boolean;
  onPerformanceChange?: (degraded: boolean) => void;
};

type SlotValue = {
  scene: PondSceneDescriptor | null;
  health: GlHealth;
  sceneReady: boolean;
  register: (scene: PondSceneDescriptor) => void;
  unregister: (scene: PondSceneDescriptor) => void;
  reportCore: (health: GlHealth, ready: boolean) => void;
};

const PondSceneSlotContext = createContext<SlotValue | null>(null);

export function PondSceneSlotProvider({ children }: { children: ReactNode }) {
  const [scene, setScene] = useState<PondSceneDescriptor | null>(null);
  const [health, setHealth] = useState<GlHealth>('unavailable');
  const [sceneReady, setSceneReady] = useState(false);
  const sceneRef = useRef<PondSceneDescriptor | null>(null);
  const register = useCallback((next: PondSceneDescriptor) => {
    sceneRef.current = next;
    setScene(next);
  }, []);
  const unregister = useCallback((leaving: PondSceneDescriptor) => {
    if (sceneRef.current === leaving) sceneRef.current = null;
    setScene((current) => current === leaving ? null : current);
  }, []);
  const reportCore = useCallback((nextHealth: GlHealth, ready: boolean) => {
    setHealth(nextHealth);
    setSceneReady(ready);
  }, []);
  const value = useMemo(() => ({
    scene, health, sceneReady, register, unregister, reportCore,
  }), [health, register, reportCore, scene, sceneReady, unregister]);
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
export function useRegisterPondScene(scene: PondSceneDescriptor) {
  const { register, unregister, health, sceneReady } = usePondSceneSlot();
  const latest = useRef(scene);
  useLayoutEffect(() => {
    latest.current = scene;
    register(scene);
  }, [register, scene]);
  useLayoutEffect(() => () => unregister(latest.current), [unregister]);
  return { health, sceneReady };
}
