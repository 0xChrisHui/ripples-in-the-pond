'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { getGroupTargetCount } from '@/src/components/archipelago/sphere-config';
import type { GlSim } from '../spheres/use-gl-sim';
import { getSubmerge } from '../water/water-level';
import { project, applyFloat } from '../sphere-projection';
import { depthOf, displayDepthOf } from '../pointer-fx';
import SphereHit, { currentSphereContext } from './SphereHit';

type Props = {
  glSim: GlSim;
  waterOn: boolean;
  glHealthy?: boolean;
  depthModel?: boolean;
  showLabels?: boolean;
};

/** GL 与兜底共用节点、投影和命中层，避免接管时重排或失去播放能力。 */
export default function SphereOverlay({
  glSim, waterOn, glHealthy = true, depthModel = false, showLabels = true,
}: Props) {
  const { nodes, playingIdRef } = glSim;
  const { playing, currentTrack } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;
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
      const focusedId = playingIdRef.current;
      const context = currentSphereContext();
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
        element.style.transform = `translate(${point.sx - node.radius}px, ${point.sy - node.radius}px) scale(${point.scale})`;
        element.style.filter = point.blurAmt > 0.02 ? `blur(${(point.blurAmt * 3).toFixed(2)}px)` : '';
        element.style.opacity = dim ? '0' : String(Math.max(0.4, 1 - submerge * 1.5) * (node._lifeDim ?? 1));
        element.style.pointerEvents = dim ? 'none' : 'auto';
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [nodes, playingIdRef, waterOn, depthModel]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10"
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
