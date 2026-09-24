'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { getGroupTargetCount } from '@/src/components/archipelago/sphere-config';
import type { GlSim } from '../spheres/use-gl-sim';
import { getSubmerge } from '../water/water-level';
import { project, applyFloat } from '../sphere-projection';
import { depthOf, displayDepthOf } from '../pointer-fx';
import { getPlaybackFocus } from '../focus/playback-focus';
import SphereHit, { currentSphereContext } from './SphereHit';

type Props = {
  glSim: GlSim;
  waterOn: boolean;
  glHealthy?: boolean;
  depthModel?: boolean;
  showLabels?: boolean;
  scenePresence?: RefObject<number>;
  interactive?: boolean;
  reducedSceneMotion?: boolean;
};

/** GL 与兜底共用节点、投影和命中层，避免接管时重排或失去播放能力。 */
export default function SphereOverlay({
  glSim, waterOn, glHealthy = true, depthModel = false, showLabels = true,
  scenePresence, interactive = true, reducedSceneMotion = false,
}: Props) {
  const { nodes, playingIdRef, wavesRef } = glSim;
  const { playing, currentTrack } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;
  const layer = useRef<HTMLDivElement>(null);
  const elements = useRef<Map<string, HTMLButtonElement>>(new Map());
  const submerged = useRef<Map<string, number>>(new Map());
  const allReady = nodes.length >= getGroupTargetCount(glSim.groupId);

  useEffect(() => {
    if (nodes.length === 0) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        performance.mark('p15:first-circles-painted');
        if (allReady) performance.mark('p15:all-circles-interactive');
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [allReady, nodes]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const focus = getPlaybackFocus();
      const focusedId = focus.active ? focus.trackId : playingIdRef.current;
      const context = currentSphereContext();
      const presence = scenePresence?.current ?? 1;
      if (layer.current) {
        const oldestWave = wavesRef.current[0];
        layer.current.dataset.scenePresence = presence.toFixed(4);
        layer.current.dataset.waveCount = String(wavesRef.current.length);
        layer.current.dataset.waveSpawn = oldestWave ? String(oldestWave.spawnTime) : '';
        layer.current.dataset.waveAge = oldestWave ? String(Math.max(0, performance.now() - oldestWave.spawnTime)) : '';
      }
      for (const node of nodes) {
        const element = elements.current.get(node.id);
        if (!element || node.x == null || node.y == null) continue;
        const dim = focusedId != null && node.id !== focusedId;
        const raw = waterOn ? getSubmerge(displayDepthOf(node)) : 0;
        let submerge = raw;
        if (depthModel) {
          submerge = (submerged.current.get(node.id) ?? raw) * 0.85 + raw * 0.15;
          submerged.current.set(node.id, submerge);
        }
        const point = applyFloat(
          project(node.x, node.y, depthOf(node), context, node),
          node, context.cx, context.cy,
        );
        const sceneScale = reducedSceneMotion ? 1 : 0.88 + presence * 0.12;
        element.style.transform = `translate(${point.sx - node.radius}px, ${point.sy - node.radius}px) scale(${point.scale * sceneScale})`;
        element.style.filter = point.blurAmt > 0.02 ? `blur(${(point.blurAmt * 3).toFixed(2)}px)` : '';
        element.style.opacity = dim ? '0' : String(
          Math.max(0.4, 1 - submerge * 1.5) * (node._lifeDim ?? 1) * presence,
        );
        element.style.pointerEvents = dim || !interactive ? 'none' : 'auto';
        element.tabIndex = dim || !interactive ? -1 : 0;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [nodes, playingIdRef, waterOn, depthModel, interactive, reducedSceneMotion, scenePresence, wavesRef]);

  return (
    <div ref={layer} className="pointer-events-none fixed inset-0 z-10"
      aria-hidden={!interactive}
      data-first-circles={nodes.length > 0} data-all-circles-interactive={allReady}>
      {nodes.map((node) => (
        <SphereHit key={node.id} node={node} glSim={glSim} glHealthy={glHealthy}
          isPlaying={playingId === node.id} showLabels={showLabels}
          register={(element) => {
            if (element) elements.current.set(node.id, element);
            else elements.current.delete(node.id);
          }} />
      ))}
    </div>
  );
}
