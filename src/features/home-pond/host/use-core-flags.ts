'use client';
import { useMemo } from 'react';
import type { GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import type { PondSceneDescriptor } from '@/src/components/pond-shell/scene-slot';
import { getScenePresence } from '@/src/components/pond-shell/motion/scene-presence';
import { ARCHIVE_FLAGS } from '../PondSceneLayers';

/** 把首页 flag 与已注册的 Score / Tracks 场景合成给 Water Core 的最终 flag。 */
export function useCoreFlags(glFlags: GLFlags, persistent: boolean, renderHomeScene: boolean,
  scoreScene?: PondSceneDescriptor, tracksScene?: PondSceneDescriptor) {
  const registeredScene = scoreScene ?? tracksScene;
  const scorePresence = useMemo(() => ({ get current() {
    return (scoreScene?.scenePresence?.current ?? 1) * getScenePresence('score');
  } }), [scoreScene]);
  const sceneFlags = useMemo(
    // 池塘气泡属于持久水面核心：档案场景（/me、/artist）也跟随首页的 pondBubbles（与花瓣同理）
    () => persistent && !renderHomeScene ? { ...ARCHIVE_FLAGS, pondBubbles: glFlags.pondBubbles } : glFlags,
    [glFlags, persistent, renderHomeScene],
  );
  const coreFlags = useMemo(() => registeredScene ? {
    ...registeredScene.flags,
    glSpheres: scoreScene ? scoreScene.flags.glSpheres : glFlags.glSpheres,
    // 水面花瓣属于持久 Water Core，路由 Scene 不得卸载并重排它。
    flowerPetals: glFlags.flowerPetals,
    pondBubbles: glFlags.pondBubbles,
    forceFallback: glFlags.forceFallback,
  } : sceneFlags, [glFlags.flowerPetals, glFlags.pondBubbles, glFlags.forceFallback, glFlags.glSpheres, registeredScene, sceneFlags, scoreScene]);
  return { registeredScene, scorePresence, coreFlags };
}
