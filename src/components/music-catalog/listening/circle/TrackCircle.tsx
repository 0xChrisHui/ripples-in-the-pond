'use client';
import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { computeNodeAttrs } from '../../../archipelago/sphere-config';
import { DEFAULT_GL_FLAGS } from '../../../pond-gl-test3/gl-flags';
import { useRegisterPondScene, type PondSceneDescriptor } from '../../../pond-shell/scene-slot';
import { usePondTransition } from '../../../pond-shell/pond-transition';
import { toPlayerTrack } from '../../../../lib/music-catalog/player-adapter';
import type { OriginalTrack } from '../../../../lib/music-catalog/types';
import { useTrackCircle } from './use-track-circle';
import CircleEclipse from './CircleEclipse';
import './circle.css';

const TrackCircleMesh = dynamic(() => import('./TrackCircleMesh'), { ssr: false });
const CIRCLE_FLAGS = { ...DEFAULT_GL_FLAGS, glSpheres: false, glEclipse: false, sphereMotion: false,
  sphereDrift: false, floatMotes: false, waterPlants: false, reefStones: false, crystalPillars: false,
  perspective: false, parallax: false, wakeSpheres: false };

export default function TrackCircle({ track, phase, onAction }: {
  track: OriginalTrack; phase: string; onAction: () => void;
}) {
  const anchor = useRef<HTMLElement>(null);
  const transition = usePondTransition();
  const owns = transition?.transaction.interactiveOwner === 'tracks';
  const [degraded, setDegraded] = useState(false);
  const [rendered, setRendered] = useState(false);
  const color = computeNodeAttrs(toPlayerTrack(track.trackId), 'A').color;
  const frame = useTrackCircle(anchor, track.trackId, phase, owns, degraded, color);
  const descriptor = useMemo<PondSceneDescriptor>(() => ({ owner: 'tracks', flags: CIRCLE_FLAGS,
    pointerInteractive: false, onPerformanceChange: setDegraded,
    sceneContent: <TrackCircleMesh frame={frame} onReady={setRendered} /> }), [frame]);
  const { health, sceneReady } = useRegisterPondScene(descriptor, owns);
  const glAvailable = health === 'healthy' && sceneReady;
  const glVisible = owns && rendered && glAvailable;
  const label = phase === 'preparing' ? '取消准备' : phase === 'playing' ? '停止聆听' : '开始聆听';
  return <figure ref={anchor} className="sound-imprint track-circle" data-track-circle={track.trackId}
    data-phase={phase} data-circle-renderer={glVisible ? 'webgl' : 'fallback'} data-circle-degraded={degraded}>
    <button className="track-circle__hit" type="button" onClick={onAction} aria-label={`${label}原曲 ${track.title}`}>
      <span className="track-circle__fallback" data-visible={owns && !glAvailable} aria-hidden="true" />
    </button>
    <CircleEclipse />
  </figure>;
}
