'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import EditionStamp from '@/src/components/p11/EditionStamp';
import RecordAnchor, { type RecordAnchorState } from '@/src/components/p11/RecordAnchor';
import ScorePondHeader from '@/src/components/p11/ScorePondHeader';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { useJam } from '@/src/hooks/useJam';
import type { KeyEvent } from '@/src/types/jam';
import type { ScorePageData } from '@/src/data/score-source';
import { DEFAULT_GL_FLAGS, isWebGLAvailable } from '@/src/components/pond-gl-test3/gl-flags';
import type { GlHealth } from '@/src/components/pond-gl-test3/PondGL';
import { resetDepthShift, setCameraFx, usePointerFx } from '@/src/components/pond-gl-test3/pointer-fx';
import GlEclipse from '@/src/components/pond-gl-test3/overlay/GlEclipse';
import { findP9Effect } from '@/src/components/pond-gl-test3/p9/registry';
import { triggerP9Effect } from '@/src/components/pond-gl-test3/p9/runtime/p9-state';
import { loadP9Tuning } from '@/src/components/pond-gl-test3/p9/tuning/p9-tuning-store';
import TokenOneArchive from './TokenOneArchive';
import { TOKEN_ONE } from './token-one-provenance';
import { useSingleSphereSim } from './useSingleSphereSim';

const PondGL = dynamic(() => import('@/src/components/pond-gl-test3/PondGL'), { ssr: false });

function useFinePointer() {
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setFinePointer(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return finePointer;
}

function useCoarsePointerGuard(finePointer: boolean) {
  useEffect(() => {
    if (finePointer) return;
    const stopMove = (event: PointerEvent) => event.stopImmediatePropagation();
    const stopBackgroundDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element && target.closest('[data-pond-ui]'))) {
        event.stopImmediatePropagation();
      }
    };
    const stopUiDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-pond-ui]')) event.stopPropagation();
    };
    window.addEventListener('pointermove', stopMove, { capture: true, passive: true });
    window.addEventListener('pointerdown', stopBackgroundDown, { capture: true, passive: true });
    document.addEventListener('pointerdown', stopUiDown);
    return () => {
      window.removeEventListener('pointermove', stopMove, true);
      window.removeEventListener('pointerdown', stopBackgroundDown, true);
      document.removeEventListener('pointerdown', stopUiDown);
    };
  }, [finePointer]);
}

/** 同一个 Player 时钟在同一帧驱动事件声音与 P9，避免两套调度器彼此漂移。 */
function usePermanentPerformance(events: KeyEvent[], trackId: string) {
  const timeline = useMemo(() => [...events].sort((a, b) => a.time - b.time), [events]);
  const { playing, currentTrack, getCurrentTime, startedAt } = usePlayer();
  const { playSound, ready, decodeReady, triggerDecode } = useJam();
  const isPlaying = playing && currentTrack?.id === trackId;

  useEffect(() => {
    if (isPlaying && ready && !decodeReady) triggerDecode();
  }, [decodeReady, isPlaying, ready, triggerDecode]);

  useEffect(() => {
    if (!isPlaying || !decodeReady) return;
    let index = 0;
    let raf = 0;
    const tick = () => {
      const elapsed = (getCurrentTime() - startedAt) * 1000;
      while (index < timeline.length && timeline[index].time <= elapsed) {
        const event = timeline[index];
        playSound(event.key);
        if (findP9Effect(event.key)) triggerP9Effect(event.key);
        index += 1;
      }
      if (index < timeline.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [decodeReady, getCurrentTime, isPlaying, playSound, startedAt, timeline]);

  const mapped = timeline.filter((event) => findP9Effect(event.key));
  return {
    eventCount: mapped.length,
    keyCount: new Set(mapped.map((event) => event.key.toLowerCase())).size,
    unmappedCount: timeline.length - mapped.length,
  };
}

type Props = { score: ScorePageData; events: KeyEvent[]; eventError?: string };

export default function SingleSpherePond({ score, events, eventError }: Props) {
  const track = score.track!;
  const glSim = useSingleSphereSim(track);
  const { playing, currentTrack } = usePlayer();
  const [health, setHealth] = useState<GlHealth>('unavailable');
  const [shareState, setShareState] = useState('分享');
  const finePointer = useFinePointer();
  const p9Coverage = usePermanentPerformance(events, track.id);
  const isPlaying = playing && currentTrack?.id === track.id;
  const glOk = health === 'healthy';
  const visualPlaying = isPlaying && glOk;
  const anchorState: RecordAnchorState = eventError ? 'error' : isPlaying ? 'playing' : 'idle';
  const flags = useMemo(() => ({
    ...DEFAULT_GL_FLAGS,
    glSpheres: visualPlaying,
    sphereMotion: false,
    sphereDrift: false,
    perspective: finePointer,
    parallax: finePointer,
    parallaxDesync: finePointer,
    wheelDesync: finePointer,
    wakeSpheres: finePointer,
  }), [finePointer, visualPlaying]);

  usePointerFx(glOk && finePointer);
  useCoarsePointerGuard(finePointer);
  useEffect(() => {
    loadP9Tuning();
    if (!isWebGLAvailable()) setHealth('forced');
    if (!finePointer) resetDepthShift();
    setCameraFx({ dof: flags.dof, perspective: flags.perspective, parallax: flags.parallax });
  }, [finePointer, flags.dof, flags.parallax, flags.perspective]);

  const performPrimaryAction = useCallback(() => {
    if (eventError) {
      window.location.reload();
      return;
    }
    void glSim.toggle(track);
  }, [eventError, glSim, track]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}/score/1`;
    const canNativeShare = typeof navigator.share === 'function';
    try {
      if (canNativeShare) await navigator.share({ title: TOKEN_ONE.name, url });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else throw new Error('clipboard unavailable');
      setShareState(canNativeShare ? '已分享' : '已复制');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareState('重试');
    }
  }, []);

  const statusText = eventError
    ?? (isPlaying
      ? visualPlaying ? '正在播放永久事件与日食演出' : '正在播放；水塘视觉暂不可用'
      : '点击唱片，播放永久事件与日食演出');
  const detailText = eventError
    ? '作品身份与凭证仍可核验，也可打开永久 Decoder。'
    : glOk ? `${p9Coverage.eventCount} 个事件 · ${p9Coverage.keyCount} 个真实键位`
      : '水塘正在准备；播放、分享与永久凭证不受阻断。';

  return (
    <main
      className="score-pond"
      data-theme="dark"
      data-p11-theme="score"
      data-capability={finePointer ? 'fine' : 'coarse'}
      data-score-anchor-state={anchorState}
      data-p9-event-count={p9Coverage.eventCount}
      data-p9-key-count={p9Coverage.keyCount}
      data-p9-unmapped-count={p9Coverage.unmappedCount}
      lang="zh-CN"
    >
      <PondGL flags={flags} glSim={glSim} onHealthChange={setHealth} />

      <section className="score-pond__hero">
        <ScorePondHeader
          backHref="/"
          network={TOKEN_ONE.network}
          tokenLabel="Token #001"
          shareAction={<button className="score-pond__share" type="button" onClick={share}>{shareState}</button>}
        />

        <div className="score-pond__identity" data-pond-ui="true">
          <EditionStamp status="finalized" detail="Token #001" />
          <h1>{TOKEN_ONE.name.replace(' #1', '')} <em>#1</em></h1>
          <p>{events.length > 0 ? `${events.length} 个永久事件` : '永久事件读取异常'} · Track {track.week}</p>
        </div>

        <div className="score-pond__anchor" data-pond-ui="true">
          <RecordAnchor
            state={anchorState}
            title={TOKEN_ONE.name}
            coverUrl={score.coverUrl}
            onAction={performPrimaryAction}
            eclipseVisual={glSim.ready && glOk ? <GlEclipse glSim={glSim} /> : undefined}
            statusText={statusText}
            detailText={detailText}
          />
        </div>
      </section>

      <TokenOneArchive score={score} />
    </main>
  );
}
