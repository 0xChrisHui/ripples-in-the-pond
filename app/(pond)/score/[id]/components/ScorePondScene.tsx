'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { preload } from 'react-dom';
import EditionStamp from '@/src/components/p11/EditionStamp';
import ScorePondHeader from '@/src/components/p11/ScorePondHeader';
import { useEclipseTransition } from '@/src/components/pond-gl-test3/focus/useEclipseTransition';
import { DEFAULT_GL_FLAGS } from '@/src/components/pond-gl-test3/gl-flags';
import GlEclipse from '@/src/components/pond-gl-test3/overlay/GlEclipse';
import { resetDepthShift, setCameraFx, usePointerFx } from '@/src/components/pond-gl-test3/pointer-fx';
import type { Track36VisitorState } from '@/src/components/pond-gl-test3/visitor/track36-state';
import type { ScoreReadyData } from '@/src/data/score-source';
import { permanentMediaCandidates } from '@/src/features/permanent-media';
import { startupSoundKeys } from '@/src/features/score-playback/resource-loader';
import { useScorePlayback } from '@/src/features/score-playback/use-score-playback';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import {
  useRegisterPondScene, type PondSceneDescriptor,
} from '@/src/components/pond-shell/scene-slot';
import { useScoreOrigin, viewTransitionName } from '@/src/components/pond-shell/score/score-origin';
import type { Track } from '@/src/types/tracks';
import ScoreArchive from './ScoreArchive';
import ScoreRecordAnchor from './ScoreRecordAnchor';
import ShareActions from './ShareActions';
import { useScorePondSim } from './use-score-pond-sim';
import { useScoreHolder } from './use-score-holder';

function useCapabilities() {
  const [value, setValue] = useState({ fine: false, reduced: false });
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setValue({ fine: fine.matches, reduced: reduced.matches });
    sync();
    fine.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    return () => {
      fine.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
    };
  }, []);
  return value;
}

type Props = { score: ScoreReadyData; network: string };

function preloadStartupAudio(score: ScoreReadyData): void {
  const bootstrap = score.playbackBootstrap;
  const identities = startupSoundKeys(bootstrap.events)
    .map((key) => bootstrap.sounds[key]).filter(Boolean);
  [bootstrap.base, ...identities].forEach((identity, index) => {
    const mirror = permanentMediaCandidates(identity.ref)
      .find((candidate) => candidate.source === 'mirror');
    if (!mirror) return;
    preload(mirror.url, {
      as: index === 0 ? 'audio' : 'fetch', crossOrigin: 'anonymous',
      fetchPriority: index === 0 ? 'high' : 'auto',
    });
  });
}

/** 链上降级时仅给渲染器补形状契约；所有值仍来自该 Token，不替换永久播放输入。 */
function visualTrackOf(score: ScoreReadyData): Track {
  return score.track ?? {
    id: `score-${score.tokenId}`, title: score.trackTitle, week: score.tokenId,
    audio_url: score.manifest.baseAudioRef, arweave_url: null, audio_gateway_urls: [],
    cover: score.coverUrl, island: 'score', created_at: score.createdAt ?? score.mintedAt,
    published: true,
  };
}

export default function ScorePondScene({ score, network }: Props) {
  preloadStartupAudio(score);
  const playback = useScorePlayback(score.playbackBootstrap);
  const { stop: stopGlobalPlayer } = usePlayer();
  const pathname = usePathname();
  const { origin, confirmScore } = useScoreOrigin();
  const holder = useScoreHolder(score.tokenId);
  const capabilities = useCapabilities();
  const [performanceReduced, setPerformanceReduced] = useState(false);
  const isPlaying = playback.state === 'playing';
  const visualTrack = useMemo(() => visualTrackOf(score), [score]);
  const { glSim, visualActive, returning } = useScorePondSim(visualTrack, isPlaying);
  const emptyVisitor = useRef<Track36VisitorState | null>(null);
  const interactive = capabilities.fine && !capabilities.reduced && !performanceReduced;
  const flags = useMemo(() => ({
    ...DEFAULT_GL_FLAGS,
    glSpheres: visualActive,
    sphereMotion: isPlaying,
    sphereDrift: isPlaying,
    perspective: interactive,
    parallax: interactive,
    parallaxDesync: interactive,
    wheelDesync: interactive,
    wakeSpheres: interactive,
    flowerPetals: !capabilities.reduced && !performanceReduced,
    floatMotes: !capabilities.reduced && !performanceReduced,
    autoDegrade: true,
  }), [capabilities.reduced, interactive, isPlaying, performanceReduced, visualActive]);
  const scene = useMemo<PondSceneDescriptor>(() => ({
    owner: 'score', flags, glSim: glSim ?? undefined,
    pointerInteractive: interactive, onPerformanceChange: setPerformanceReduced,
  }), [flags, glSim, interactive]);
  const { health, sceneReady } = useRegisterPondScene(scene);
  useEclipseTransition(
    glSim!, emptyVisitor,
    health === 'healthy' && sceneReady && visualActive ? visualTrack.id : null,
  );

  useEffect(() => {
    if (playback.state === 'playing') stopGlobalPlayer();
  }, [playback.state, stopGlobalPlayer]);

  // Score 是纵向阅读页：保留鼠标视差，但滚轮必须始终交还给页面滚动。
  usePointerFx(Boolean(glSim) && health === 'healthy' && interactive, false);
  useEffect(() => {
    if (!interactive) resetDepthShift();
    setCameraFx({ dof: flags.dof, perspective: flags.perspective, parallax: flags.parallax });
    return () => resetDepthShift();
  }, [flags.dof, flags.parallax, flags.perspective, glSim, interactive]);

  const tokenLabel = `Token #${String(score.tokenId).padStart(3, '0')}`;
  const title = `Ripples #${score.tokenId}`;
  const editionStatus = score.degraded ? 'degraded' : 'finalized';
  const anchored = origin?.href === pathname && origin.tokenId === score.tokenId;
  useLayoutEffect(() => {
    confirmScore(score.tokenId, pathname);
  }, [confirmScore, pathname, score.tokenId]);

  return (
    <main
      className="score-pond-page"
      data-p11-theme="score"
      data-theme="dark"
      data-pond-root="true"
      data-pond-eclipse-active="false"
      data-capability={capabilities.fine ? 'fine' : 'coarse'}
      data-reduced-motion={capabilities.reduced}
      data-score-state="ready"
      data-score-anchor-transition={anchored || undefined}
      data-playback-state={playback.state}
      data-record-motion={returning ? 'returning' : isPlaying ? 'flowing' : 'resting'}
      data-resource-load-ms={playback.resourceLoadMs ?? undefined}
      data-decode-ms={playback.decodeMs ?? undefined}
      data-first-sound-expected-ms={playback.firstSoundExpectedMs ?? undefined}
      data-gl-health={health}
      data-scene-ready={sceneReady}
      lang="zh-CN"
    >
      {visualActive && glSim?.ready && health === 'healthy' && sceneReady && (
        <div className="pointer-events-none fixed inset-0 z-[35]">
          <GlEclipse glSim={glSim} />
        </div>
      )}
      <section className="score-pond-page__hero">
        <ScorePondHeader
          backHref="/me"
          backLabel="返回档案"
          network={network}
          tokenLabel={tokenLabel}
          onBeforeBack={() => { void playback.pause(); }}
          shareAction={<ShareActions id={score.id} tokenId={score.tokenId} trackTitle={score.trackTitle} />}
        />
        <div className="score-pond-page__identity" data-pond-ui="true">
          <EditionStamp status={editionStatus} detail={tokenLabel} />
          <h1>{title}</h1>
          <p>{score.trackTitle} · {score.eventCount} 个永久事件</p>
        </div>
        <div className="score-pond-page__anchor" data-pond-ui="true"
          data-score-token-id={score.tokenId} data-score-anchor-ready={anchored || undefined}
          style={anchored ? { viewTransitionName: viewTransitionName() } as CSSProperties : undefined}>
          <ScoreRecordAnchor
            title={title}
            coverUrl={score.coverUrl}
            playback={playback}
            eclipseAvailable={Boolean(glSim?.ready && health === 'healthy' && sceneReady)}
          />
        </div>
      </section>
      <ScoreArchive score={score} holder={holder} />
    </main>
  );
}
