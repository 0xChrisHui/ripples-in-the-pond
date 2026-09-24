'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import {
  Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode, type TransitionEvent,
} from 'react';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import TestJam from '@/src/components/jam/TestJam';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { DEFAULT_GL_FLAGS, parseGLFlags, type GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import { useEclipseTransition } from '@/src/components/pond-gl-test3/focus/useEclipseTransition';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import GlEclipse from '@/src/components/pond-gl-test3/overlay/GlEclipse';
import GlLoading from '@/src/components/pond-gl-test3/overlay/GlLoading';
import GlNav from '@/src/components/pond-gl-test3/overlay/GlNav';
import PondHeader from '@/src/components/pond-gl-test3/overlay/PondHeader';
import SphereOverlay from '@/src/components/pond-gl-test3/overlay/SphereOverlay';
import SceneCover from '@/src/components/pond-gl-test3/presentation/SceneCover';
import { setCameraFx, usePointerFx } from '@/src/components/pond-gl-test3/pointer-fx';
import { loadP9Tuning } from '@/src/components/pond-gl-test3/p9/tuning/p9-tuning-store';
import { useGlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import FeaturedEchoBottomPlayer from '@/src/components/pond-gl-test3/visitor/FeaturedEchoBottomPlayer';
import Track36HitTarget from '@/src/components/pond-gl-test3/visitor/Track36HitTarget';
import { useFeaturedEchoPlayback } from '@/src/components/pond-gl-test3/visitor/useFeaturedEchoPlayback';
import { useTrack36Visitor } from '@/src/components/pond-gl-test3/visitor/useTrack36Visitor';
import type { FeaturedEcho, FeaturedEchoResponse } from '@/src/types/featured-echo';
import PersistentWaterCore from '@/src/components/pond-shell/PersistentWaterCore';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';

const SandboxControls = dynamic(() => import('./SandboxControls'), { ssr: false });

type PondMode = 'production' | 'test3' | 'test4';

/** 生产与沙盒共用同一水塘；沙盒控制器保持在独立异步 chunk。 */
const ARCHIVE_FLAGS: GLFlags = {
  ...DEFAULT_GL_FLAGS,
  glSpheres: false,
  sphereLabels: false,
  sphereMotion: false,
  sphereDrift: false,
  glEclipse: false,
  floatMotes: false,
  waterPlants: false,
  reefStones: false,
  crystalPillars: false,
};

export default function PondExperience({ mode, persistent = false, children }: {
  mode: PondMode;
  persistent?: boolean;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const transition = usePondTransition();
  const [mountId, setMountId] = useState<string | null>(null);
  const sandbox = mode !== 'production';
  const p9Enabled = mode !== 'test4';
  const phase = transition?.phase ?? (pathname === '/' ? 'home' : 'archive');
  const homeVisible = !persistent || phase === 'home' || phase === 'entering-home';
  const homeInteractive = !persistent || phase === 'home';
  const [homeInitialized, setHomeInitialized] = useState(homeVisible);
  const [glFlags, setGlFlags] = useState<GLFlags>(DEFAULT_GL_FLAGS);
  const [runtimeGlHealth, setRuntimeGlHealth] = useState<GlHealth>('unavailable');
  const [sceneReady, setSceneReady] = useState(false);
  const [featuredEcho, setFeaturedEcho] = useState<FeaturedEcho | null>(null);
  useEffect(() => {
    queueMicrotask(() => setMountId(`pond-${crypto.randomUUID()}`));
    // 不用 useSearchParams：它会迫使外壳整体进入 Suspense，并发导航时冻结持续水面。
    const search = window.location.search;
    if (search) queueMicrotask(() => setGlFlags(parseGLFlags(new URLSearchParams(search))));
  }, []);
  const onGl = useCallback((patch: Partial<GLFlags>) => {
    setGlFlags((flags) => ({ ...flags, ...patch }));
  }, []);
  const { playing, currentTrack } = usePlayer();
  const echoPlayback = useFeaturedEchoPlayback(featuredEcho);
  useEffect(() => {
    if (homeVisible) queueMicrotask(() => setHomeInitialized(true));
  }, [homeVisible]);
  const glSim = useGlSim(
    homeInitialized && (glFlags.glSpheres || glFlags.water || glFlags.waterFx),
    echoPlayback.active,
    homeInteractive,
  );
  const sceneFlags = useMemo(
    () => persistent && !homeVisible ? ARCHIVE_FLAGS : glFlags,
    [glFlags, homeVisible, persistent],
  );
  const glHealth: GlHealth = glFlags.forceFallback ? 'forced' : runtimeGlHealth;
  const glOk = glHealth === 'healthy' && sceneReady;
  const regularPlayingId = playing && currentTrack ? currentTrack.id : null;
  const playingId = echoPlayback.playing ? featuredEcho?.playbackId ?? null : regularPlayingId;
  const activePlaybackId = echoPlayback.active ? featuredEcho?.playbackId ?? null : regularPlayingId;
  const visitor = useTrack36Visitor(featuredEcho, glOk && glFlags.glSpheres, activePlaybackId);
  useEclipseTransition(glSim, visitor, glOk ? playingId : null);
  const mountGl = glFlags.glBase || glFlags.glSpheres || glFlags.water || glFlags.bgImage
    || glFlags.rtt || glFlags.waterFx || glFlags.floatMotes || glFlags.waterPlants
    || glFlags.reefStones || glFlags.crystalPillars;

  usePointerFx(homeInteractive && glOk && glFlags.glSpheres && (glFlags.perspective || glFlags.parallax));
  useEffect(() => {
    setCameraFx({ dof: glFlags.dof, perspective: glFlags.perspective, parallax: glFlags.parallax });
  }, [glFlags.dof, glFlags.perspective, glFlags.parallax]);
  useEffect(() => { if (p9Enabled && homeInteractive) loadP9Tuning(); }, [homeInteractive, p9Enabled]);
  // 只由完全显现的入场层收场：渐隐离场层的 transitionend 会被浏览器延迟补发，子元素事件也会冒泡上来。
  const settleOnReveal = (event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (getComputedStyle(event.currentTarget).opacity === '1') transition?.settle();
  };
  useEffect(() => {
    if (!homeInitialized) return;
    const controller = new AbortController();
    void fetch('/api/echo/featured', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`featured echo HTTP ${response.status}`);
        const body = await response.json() as FeaturedEchoResponse;
        setFeaturedEcho(body.echo);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.info('[pond] Pond Echo #1 暂不展示:', error);
        setFeaturedEcho(null);
      });
    return () => controller.abort();
  }, [homeInitialized]);

  return (
    <div className={persistent ? 'persistent-pond-shell' : undefined}
      data-pond-shell={persistent || undefined} data-pond-mount-id={persistent ? mountId ?? undefined : undefined}
      data-pond-scene-owner={homeVisible ? 'home' : 'archive'}
      data-pond-scene={homeVisible ? 'home' : 'archive'} data-pond-transition={persistent ? phase : undefined}
      style={persistent ? { '--pond-route-duration': `${transition?.duration ?? 0}ms` } as CSSProperties : undefined}>
      {mountGl && <PersistentWaterCore flags={sceneFlags} glSim={glSim} visitor={visitor}
        onHealthChange={setRuntimeGlHealth} onSceneReadyChange={setSceneReady} />}
      <main className={`${persistent ? 'pond-home-surface fixed inset-0 bg-transparent' : 'relative bg-black'} min-h-screen overflow-hidden`}
        data-active={homeVisible} aria-hidden={!homeVisible} inert={persistent && !homeInteractive}
        onTransitionEnd={settleOnReveal}
        data-pond-root="true"
        data-pond-eclipse-active="false" data-gl-health={glHealth} data-scene-ready={sceneReady}>
      {/* 跟随页面首屏挂载并高于 DOM 备用圆；最终水面或可用 fallback 就绪后再撤。 */}
      <div className={`fixed inset-0 z-[25] ${mountGl && !sceneReady ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <SceneCover artDir={glFlags.artDir} visible={mountGl && !sceneReady} />
      </div>
      <PondHeader />
      {glSim.ready && glOk && <GlNav glSim={glSim} playbackActive={echoPlayback.active}
        featured={featuredEcho !== null} />}
      {glFlags.glSpheres && (glSim.loading || glSim.error) && (
        <GlLoading error={glSim.error} onRetry={glSim.retry} />
      )}
      <div data-pond-ui="true" className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto"><TestJam p9Enabled={p9Enabled} /></div>
      </div>
      {glFlags.glSpheres && glSim.ready && sceneReady && (
        <SphereOverlay glSim={glSim} waterOn={glFlags.water || glFlags.waterFx}
          glHealthy={glOk} depthModel={glFlags.depthModel} showLabels={glFlags.sphereLabels} />
      )}
      {glFlags.glSpheres && featuredEcho && sceneReady && (
        <div className="pointer-events-none fixed inset-0 z-10">
          <Track36HitTarget echo={featuredEcho} visitor={visitor}
            playbackState={echoPlayback.state} fallback={!glOk} toggle={echoPlayback.toggle} />
        </div>
      )}
      {glFlags.glSpheres && glFlags.glEclipse && glSim.ready && glOk && <GlEclipse glSim={glSim} />}
      {sandbox && <SandboxControls flags={glFlags} p9={mode === 'test3'} onChange={onGl} />}
      <DraftSavedToast />
      <FeaturedEchoBottomPlayer echo={featuredEcho} playback={echoPlayback} />
      </main>
      {persistent && <div className="pond-route-surface" onTransitionEnd={settleOnReveal}>
        <Suspense fallback={null}>{children}</Suspense>
      </div>}
    </div>
  );
}
