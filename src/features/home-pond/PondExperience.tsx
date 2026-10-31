'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import TestJam from '@/src/components/jam/TestJam';
import { usePlayer } from '@/src/components/player/PlayerProvider';
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
import { useFeaturedEchoPlayback } from '@/src/components/pond-gl-test3/visitor/useFeaturedEchoPlayback';
import { usePersonalEcho } from '@/src/hooks/echo/usePersonalEcho';
import { useHomeFlags } from './host/use-home-flags';
import { useCoreFlags } from './host/use-core-flags';
import LensSlot from './host/LensSlot';
import PersistentWaterCore from '@/src/components/pond-shell/PersistentWaterCore';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';
import { isHomePath, LAB_PATH, LENS_PATH } from '@/src/components/pond-shell/transition/types';
import { useScenePresence } from '@/src/components/pond-shell/motion/use-scene-presence';
import { usePreparedArchive } from '@/src/components/pond-shell/use-prepared-archive';
import { useOptionalPondSceneSlot } from '@/src/components/pond-shell/scene-slot';
import HomeEclipseDriver from '@/src/components/pond-shell/HomeEclipseDriver';
import PersistentRouteSurfaces from './PersistentRouteSurfaces';
import PondSceneLayers from './PondSceneLayers';
import dynamic from 'next/dynamic';
const SandboxControls = dynamic(() => import('./SandboxControls'), { ssr: false });
type PondMode = 'production' | 'test3' | 'test4';
/** 生产与沙盒共用同一水塘；沙盒控制器保持在独立异步 chunk。 */
export default function PondExperience({ mode, persistent = false, children }: {
  mode: PondMode;
  persistent?: boolean;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const transition = usePondTransition();
  const sceneSlot = useOptionalPondSceneSlot();
  const reportCore = sceneSlot?.reportCore;
  const lab = pathname === LAB_PATH;
  const sandbox = mode !== 'production' || lab; // /test5 = 首页外壳 + 沙盒控制台
  const p9Enabled = mode !== 'test4';
  const phase = transition?.phase ?? (isHomePath(pathname) ? 'home' : 'archive');
  const homeVisible = !persistent || phase === 'home' || phase === 'entering-home';
  const homeInteractive = !persistent || transition?.transaction.interactiveOwner === 'home';
  const renderHomeScene = homeInteractive || (transition?.transaction.current === 'home' && transition.transaction.stage !== 'stable');
  const prepareArchive = usePreparedArchive(pathname, persistent);
  const sceneMotion = useScenePresence(phase, transition?.duration ?? 0, persistent);
  const [homeInitialized, setHomeInitialized] = useState(homeVisible);
  const [runtimeGlHealth, setRuntimeGlHealth] = useState<GlHealth>('unavailable');
  const [sceneReady, setSceneReady] = useState(false);
  const personalEcho = usePersonalEcho(homeInitialized, homeVisible);
  const { mountId, glFlags, devFakeEcho, onGl } = useHomeFlags();
  const featuredEcho = devFakeEcho ?? personalEcho; // 仅开发环境 ?fakeEcho=1，生产恒为 personalEcho
  const { playing, currentTrack } = usePlayer();
  const echoPlayback = useFeaturedEchoPlayback(featuredEcho);
  useEffect(() => {
    if (homeVisible) queueMicrotask(() => setHomeInitialized(true));
  }, [homeVisible]);
  // 水面首次就绪后才把 #36 交给 GL：否则 1.5s 渐显会在加载遮罩后耗尽。锁存，避免之后抖动触发退场。
  const [echoRevealed, setEchoRevealed] = useState(false);
  useEffect(() => {
    if (sceneReady) queueMicrotask(() => setEchoRevealed(true));
  }, [sceneReady]);
  const glSim = useGlSim(
    homeInitialized && (glFlags.glSpheres || glFlags.water || glFlags.waterFx),
    echoPlayback.active,
    homeInteractive,
    { echo: echoRevealed ? featuredEcho : null, playingId: echoPlayback.playing ? featuredEcho?.playbackId ?? null : null, toggle: echoPlayback.toggle },
  );
  const scoreScene = persistent ? sceneSlot?.scenes.score : undefined;
  const tracksScene = persistent ? sceneSlot?.scenes.tracks : undefined;
  const { registeredScene, scorePresence, coreFlags } = useCoreFlags(glFlags, persistent, renderHomeScene, scoreScene, tracksScene);
  const glHealth: GlHealth = glFlags.forceFallback ? 'forced' : runtimeGlHealth;
  const glOk = glHealth === 'healthy' && sceneReady;
  const regularPlayingId = playing && currentTrack ? currentTrack.id : null;
  const playingId = echoPlayback.playing ? featuredEcho?.playbackId ?? null : regularPlayingId;
  const coreSim = scoreScene?.glSim ?? glSim;
  const coreVisitor = registeredScene?.visitor;
  const mountGl = coreFlags.glBase || coreFlags.glSpheres || coreFlags.water || coreFlags.bgImage
    || coreFlags.rtt || coreFlags.waterFx || coreFlags.floatMotes || coreFlags.waterPlants
    || coreFlags.reefStones || coreFlags.crystalPillars;
  useEffect(() => {
    reportCore?.(glHealth, sceneReady);
  }, [glHealth, reportCore, sceneReady]);
  usePointerFx(homeInteractive && glOk && glFlags.glSpheres && (glFlags.perspective || glFlags.parallax));
  useEffect(() => {
    if (registeredScene) return;
    setCameraFx({ dof: glFlags.dof, perspective: glFlags.perspective, parallax: glFlags.parallax });
  }, [glFlags.dof, glFlags.perspective, glFlags.parallax, registeredScene]);
  useEffect(() => { if (p9Enabled && homeInteractive) loadP9Tuning(); }, [homeInteractive, p9Enabled]);
  return (
    <div className={persistent ? 'persistent-pond-shell' : undefined}
      data-pond-shell={persistent || undefined} data-pond-mount-id={persistent ? mountId ?? undefined : undefined}
      data-pond-scene-owner={registeredScene?.owner ?? (homeVisible ? 'home' : phase === 'tracks' ? 'tracks' : 'archive')}
      data-pond-scene={registeredScene?.owner ?? (homeVisible ? 'home' : phase === 'tracks' ? 'tracks' : 'archive')}
      data-pond-scene-ready={sceneReady} data-pond-transition={persistent ? phase : undefined}
      data-pond-current={persistent ? transition?.transaction.current : undefined}
      data-pond-target={persistent ? transition?.transaction.target : undefined}
      data-pond-stage={persistent ? transition?.transaction.stage : undefined}
      data-pond-interactive-owner={persistent ? transition?.transaction.interactiveOwner : undefined}
      data-pond-generation={persistent ? transition?.transaction.generation : undefined}
      data-pond-reduced-scene-motion={persistent ? sceneMotion.reduced : undefined}
      style={persistent ? { '--pond-route-duration': `${transition?.duration ?? 0}ms` } as CSSProperties : undefined}>
      {mountGl && <PersistentWaterCore flags={coreFlags} glSim={coreSim} visitor={coreVisitor}
        sceneContent={<PondSceneLayers home={glSim} flags={glFlags} presence={sceneMotion.presence}
          reduced={sceneMotion.reduced} score={scoreScene} tracks={tracksScene} />}
        scenePresence={scoreScene ? scorePresence : sceneMotion.presence}
        reducedSceneMotion={registeredScene ? undefined : sceneMotion.reduced}
        pointerInteractive
        onPerformanceChange={registeredScene?.onPerformanceChange}
        onHealthChange={setRuntimeGlHealth} onSceneReadyChange={setSceneReady} />}
      <PersistentRouteSurfaces persistent={persistent} pathname={pathname}
        prepareArchive={prepareArchive} homeRoot={phase !== 'score'} glHealth={glHealth}
        sceneReady={sceneReady}
        homeClassName={`${persistent ? 'pond-home-surface fixed inset-0 bg-transparent' : 'relative bg-black'} min-h-screen overflow-hidden`}
        home={<>
      {/* 跟随页面首屏挂载并高于 DOM 备用圆；最终水面或可用 fallback 就绪后再撤。 */}
      <div className={`fixed inset-0 z-[25] ${mountGl && !sceneReady ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <SceneCover artDir={glFlags.artDir} visible={mountGl && !sceneReady} waiting={mountGl && !sceneReady} />
      </div>
      {!persistent && <PondHeader />}
      {glSim.ready && glOk && (
        <div className="pond-reveal" data-ready={sceneReady} style={{ '--pond-reveal-delay': '250ms' } as CSSProperties}>
          <GlNav glSim={glSim} playbackActive={echoPlayback.active} featured={featuredEcho !== null} />
        </div>
      )}
      {glFlags.glSpheres && glSim.error && (
        <GlLoading onRetry={glSim.retry} />
      )}
      <div data-pond-ui="true" className="pond-reveal pointer-events-none fixed left-6 z-30" data-ready={sceneReady}
        style={{ top: '14rem', '--pond-reveal-delay': '400ms' } as CSSProperties}>
        <div className="pointer-events-auto">
          {homeInitialized && <TestJam p9Enabled={p9Enabled} enabled={homeInteractive} />}
        </div>
      </div>
      {glFlags.glSpheres && glSim.ready && sceneReady && (
        <div className="pond-reveal" data-ready style={{ '--pond-reveal-delay': '100ms' } as CSSProperties}>
          <SphereOverlay glSim={glSim} waterOn={glFlags.water || glFlags.waterFx}
            glHealthy={glOk} depthModel={glFlags.depthModel} showLabels={glFlags.sphereLabels}
            scenePresence={sceneMotion.presence} interactive={homeInteractive}
            reducedSceneMotion={sceneMotion.reduced} lensMode={pathname === LENS_PATH} />
        </div>
      )}
      {glFlags.glSpheres && glSim.ready && sceneReady && <LensSlot pathname={pathname} glSim={glSim} stopEcho={echoPlayback.stop} />}
      {renderHomeScene && glFlags.glSpheres && glFlags.glEclipse && glSim.ready && glOk && <GlEclipse glSim={glSim} />}
      {homeInteractive && <HomeEclipseDriver glSim={glSim} playingId={glOk ? playingId : null} />}
      {sandbox && <SandboxControls flags={glFlags} p9={mode === 'test3'} bubblesOnly={lab} onChange={onGl} />}
      <DraftSavedToast />
      <FeaturedEchoBottomPlayer echo={featuredEcho} playback={echoPlayback} />
        </>}>{children}</PersistentRouteSurfaces>
    </div>
  );
}
