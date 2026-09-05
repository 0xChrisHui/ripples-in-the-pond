'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import EditionStamp from '@/src/components/p11/EditionStamp';
import ScorePondHeader from '@/src/components/p11/ScorePondHeader';
import { DEFAULT_GL_FLAGS } from '@/src/components/pond-gl-test3/gl-flags';
import GlEclipse from '@/src/components/pond-gl-test3/overlay/GlEclipse';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import { resetDepthShift, setCameraFx, usePointerFx } from '@/src/components/pond-gl-test3/pointer-fx';
import type { ScoreReadyData } from '@/src/data/score-source';
import { useScorePlayback } from '@/src/features/score-playback/use-score-playback';
import type { Track } from '@/src/types/tracks';
import ScoreArchive from './ScoreArchive';
import ScoreRecordAnchor from './ScoreRecordAnchor';
import ShareActions from './ShareActions';
import { useScorePondSim } from './use-score-pond-sim';

const PondGL = dynamic(() => import('@/src/components/pond-gl-test3/PondGL'), { ssr: false });

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

/** 链上降级时仅给渲染器补形状契约；所有值仍来自该 Token，不替换永久播放输入。 */
function visualTrackOf(score: ScoreReadyData): Track {
  return score.track ?? {
    id: `score-${score.tokenId}`, title: score.trackTitle, week: score.tokenId,
    audio_url: score.manifest.baseAudioRef, cover: score.coverUrl, island: 'score',
    created_at: score.createdAt ?? score.mintedAt, published: true,
  };
}

export default function ScorePondScene({ score, network }: Props) {
  const playback = useScorePlayback(score.manifest);
  const capabilities = useCapabilities();
  const [health, setHealth] = useState<GlHealth>('unavailable');
  const [performanceReduced, setPerformanceReduced] = useState(false);
  const isPlaying = playback.state === 'playing';
  const visualTrack = useMemo(() => visualTrackOf(score), [score]);
  const glSim = useScorePondSim(visualTrack, isPlaying);
  const interactive = capabilities.fine && !capabilities.reduced && !performanceReduced;
  const flags = useMemo(() => ({
    ...DEFAULT_GL_FLAGS,
    glSpheres: isPlaying,
    sphereMotion: false,
    sphereDrift: false,
    perspective: interactive,
    parallax: interactive,
    parallaxDesync: interactive,
    wheelDesync: interactive,
    wakeSpheres: interactive,
    flowerPetals: !capabilities.reduced && !performanceReduced,
    floatMotes: !capabilities.reduced && !performanceReduced,
    autoDegrade: true,
  }), [capabilities.reduced, interactive, isPlaying, performanceReduced]);

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

  return (
    <main
      className="score-pond-page"
      data-p11-theme="score"
      data-theme="dark"
      data-capability={capabilities.fine ? 'fine' : 'coarse'}
      data-reduced-motion={capabilities.reduced}
      data-score-state="ready"
      data-playback-state={playback.state}
      data-gl-health={health}
      lang="zh-CN"
    >
      {glSim && (
        <PondGL
          flags={flags}
          glSim={glSim}
          onHealthChange={setHealth}
          onPerformanceChange={setPerformanceReduced}
          pointerInteractive={interactive}
        />
      )}
      {isPlaying && glSim?.ready && health === 'healthy' && (
        <div className="pointer-events-none fixed inset-0 z-[35]">
          <GlEclipse glSim={glSim} />
        </div>
      )}
      <section className="score-pond-page__hero">
        <ScorePondHeader
          backHref="/"
          network={network}
          tokenLabel={tokenLabel}
          shareAction={<ShareActions id={score.id} tokenId={score.tokenId} trackTitle={score.trackTitle} />}
        />
        <div className="score-pond-page__identity" data-pond-ui="true">
          <EditionStamp status={editionStatus} detail={tokenLabel} />
          <h1>{title}</h1>
          <p>{score.trackTitle} · {score.eventCount} 个永久事件</p>
        </div>
        <div className="score-pond-page__anchor" data-pond-ui="true">
          <ScoreRecordAnchor
            title={title}
            coverUrl={score.coverUrl}
            playback={playback}
            eclipseAvailable={Boolean(glSim?.ready && health === 'healthy')}
          />
        </div>
      </section>
      <ScoreArchive score={score} />
    </main>
  );
}
