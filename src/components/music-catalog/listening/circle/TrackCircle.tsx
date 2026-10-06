'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { computeNodeAttrs } from '../../../archipelago/sphere-config';
import { DEFAULT_GL_FLAGS } from '../../../pond-gl-test3/gl-flags';
import { useRegisterPondScene, type PondSceneDescriptor } from '../../../pond-shell/scene-slot';
import { usePondTransition } from '../../../pond-shell/pond-transition';
import { toPlayerTrack } from '../../../../lib/music-catalog/player-adapter';
import type { OriginalTrack } from '../../../../lib/music-catalog/types';
import { useTrackCircle } from './use-track-circle';
import CircleEclipse from './CircleEclipse';
import TrackCircleMesh from './TrackCircleMesh';
import './circle.css';

const CIRCLE_FLAGS = { ...DEFAULT_GL_FLAGS, glSpheres: false, glEclipse: false, sphereMotion: false,
  sphereDrift: false, floatMotes: false, waterPlants: false, reefStones: false, crystalPillars: false,
  perspective: false, parallax: false, wakeSpheres: false };

export default function TrackCircle({ track, phase, onAction }: {
  track: OriginalTrack; phase: string; onAction: () => void;
}) {
  const anchor = useRef<HTMLElement>(null);
  const transition = usePondTransition();
  const owns = transition?.transaction.interactiveOwner === 'tracks';
  const transaction = transition?.transaction;
  const active = owns || (!!transaction && transaction.stage !== 'stable'
    && (transaction.current === 'tracks' || transaction.target === 'tracks'));
  const [degraded, setDegraded] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [everRendered, setEverRendered] = useState(false);
  const onReady = useCallback((ready: boolean) => {
    setRendered(ready);
    if (ready) setEverRendered(true);
  }, []);
  const { color, importance } = computeNodeAttrs(toPlayerTrack(track.trackId), 'A');
  const { frame, setHovered } = useTrackCircle(anchor, track.trackId, phase, owns, degraded, color, importance);
  const descriptor = useMemo<PondSceneDescriptor>(() => ({ owner: 'tracks', flags: CIRCLE_FLAGS,
    pointerInteractive: true, onPerformanceChange: setDegraded,
    sceneContent: <TrackCircleMesh frame={frame} onReady={onReady} /> }), [frame, onReady]);
  const { health, sceneReady } = useRegisterPondScene(descriptor, active);
  const glAvailable = health === 'healthy' && sceneReady;
  const glVisible = active && rendered && glAvailable;
  const label = phase === 'preparing' ? '取消准备' : phase === 'playing' ? '停止聆听' : '开始聆听';
  return <figure ref={anchor} className="sound-imprint track-circle" data-track-circle={track.trackId}
    data-phase={phase} data-circle-renderer={glVisible ? 'webgl' : 'fallback'} data-circle-degraded={degraded}>
    <button className="track-circle__hit" type="button" onClick={onAction} disabled={!owns}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
      aria-label={`${label}原曲 ${track.title}`} aria-pressed={phase === 'playing'}>
      <span className="track-circle__fallback" data-visible={active && (!glAvailable || !everRendered)}
        data-initializing={!everRendered} aria-hidden="true" />
    </button>
    <CircleEclipse frame={frame} />
  </figure>;
}
