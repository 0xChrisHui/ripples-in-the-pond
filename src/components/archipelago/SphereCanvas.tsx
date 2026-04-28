'use client';

import { useEffect, useMemo, useRef } from 'react';
import { type Simulation } from 'd3-force';
import type { Track } from '@/src/types/tracks';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import SphereNode from './SphereNode';
import SphereGlowDefs from './SphereGlowDefs';
import EclipseLayer from './EclipseLayer';
import {
  computeNodeAttrs,
  generateLinks,
  getGroupTracks,
  padTracksToTarget,
  type GroupId,
  type SimNode,
  type SimLink,
} from './sphere-config';
import { setupSimulation, attachDrag } from './sphere-sim-setup';
import { useSphereZoom } from './use-sphere-zoom';

/**
 * Phase 6 B2.1 — sound-spheres 完整复刻
 * 数据稀少时 padding 到 36 / forceX/Y + clamp 防飞出 / 渲染连接线
 */

const TARGET_NODE_COUNT = 36;

interface Props {
  tracks: Track[];
  currentGroupId: GroupId;
  mintedIds: Set<number>;
  onMinted: (tokenId: number) => void;
}

export default function SphereCanvas({
  tracks,
  currentGroupId,
  mintedIds,
  onMinted,
}: Props) {
  const { playing, currentTrack, toggle } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;

  // 当前 group 的 tracks → padding 到 36（DB 仅 5 首样本时复用真实数据）
  const tracksToShow = useMemo<Track[]>(
    () => padTracksToTarget(getGroupTracks(currentGroupId, tracks), TARGET_NODE_COUNT),
    [tracks, currentGroupId],
  );

  const simNodes = useMemo<SimNode[]>(
    () =>
      tracksToShow.map((t) => ({
        id: t.id,
        track: t,
        ...computeNodeAttrs(t, currentGroupId),
      })),
    [tracksToShow, currentGroupId],
  );

  const simLinks = useMemo<SimLink[]>(() => generateLinks(simNodes), [simNodes]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGRef = useRef<SVGGElement | null>(null);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);

  // 日食覆盖层（独立 fixed z-[55] svg，不被按键动画 z-40 遮）
  const eclipseZoomGRef = useRef<SVGGElement | null>(null);
  const eclipseGRef = useRef<SVGGElement | null>(null);

  // playingId 用 ref 让 tick 拿到最新值，避免 sim useEffect 因 playingId 重建（位置刷新）
  const playingIdRef = useRef<string | null>(null);
  useEffect(() => {
    playingIdRef.current = playingId;
  }, [playingId]);

  // ── D3 force simulation + drag + line tick（每次 currentGroupId 变化重建）──
  useEffect(() => {
    if (!svgRef.current || simNodes.length === 0) return;

    const W = svgRef.current.clientWidth || 800;
    const H = svgRef.current.clientHeight || 600;

    const sim = setupSimulation(simNodes, simLinks, W, H, () => {
      // 节点 transform
      simNodes.forEach((n, i) => {
        const el = nodeRefs.current[i];
        if (el && n.x != null && n.y != null) {
          el.setAttribute('transform', `translate(${n.x},${n.y})`);
        }
      });
      // 连接线 x1/y1/x2/y2（forceLink 已把 source/target string 替换为 SimNode 引用）
      simLinks.forEach((l, i) => {
        const lineEl = lineRefs.current[i];
        const src = l.source as SimNode;
        const tgt = l.target as SimNode;
        if (lineEl && src.x != null && src.y != null && tgt.x != null && tgt.y != null) {
          lineEl.setAttribute('x1', String(src.x));
          lineEl.setAttribute('y1', String(src.y));
          lineEl.setAttribute('x2', String(tgt.x));
          lineEl.setAttribute('y2', String(tgt.y));
        }
      });
      // 日食位置同步（用 ref 读最新 playingId，sim 不会因 play/pause 重建）
      const eclipseEl = eclipseGRef.current;
      if (eclipseEl) {
        const pid = playingIdRef.current;
        const playingNode = pid ? simNodes.find((n) => n.id === pid) : null;
        if (playingNode && playingNode.x != null && playingNode.y != null) {
          const s = playingNode.radius / 50; // EclipseLayer unit r=50
          eclipseEl.setAttribute(
            'transform',
            `translate(${playingNode.x},${playingNode.y}) scale(${s})`,
          );
          eclipseEl.style.display = 'block';
        } else {
          eclipseEl.style.display = 'none';
        }
      }
    });

    simRef.current = sim;
    attachDrag(nodeRefs.current, simNodes, sim);

    return () => {
      sim.stop();
    };
  }, [simNodes, simLinks]);

  // d3.zoom 行为抽出（含日食层 transform 同步 + 放大停 jitter）
  useSphereZoom(svgRef, zoomGRef, eclipseZoomGRef, simRef);

  return (
    <>
    <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing">
      <SphereGlowDefs />
      {/* v19：zoomG 加 will-change: transform，让浏览器提前给 sphere group 分配 GPU layer
          减少 zoom 时反复重 layer 化的开销，改善放大状态下的 ripple/glow 渲染稳定性 */}
      <g ref={zoomGRef} style={{ willChange: 'transform' }}>
        {/* 连接线层（在节点下面；日食模式下整体淡出隐藏）*/}
        <g style={{ opacity: playingId !== null ? 0 : 1, transition: 'opacity 0.5s ease', pointerEvents: 'none' }}>
          {simLinks.map((l, i) => {
            const src = simNodes.find((n) => n.id === (typeof l.source === 'string' ? l.source : (l.source as SimNode).id));
            const strokeColor = src?.color ?? '#888';
            return (
              <line
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                stroke={strokeColor}
                strokeWidth={0.4 + l.correlation * 1.4}
                strokeOpacity={0.05 + l.correlation * 0.13}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}
        </g>
        {/* 节点层 */}
        <g>
          {simNodes.map((n, i) => {
            const dimmed = playingId !== null && playingId !== n.track.id;
            const isPlaying = playingId === n.track.id;
            return (
              <g
                key={n.id}
                ref={(el) => { nodeRefs.current[i] = el; }}
                style={{
                  opacity: dimmed ? 0 : 1,
                  transition: 'opacity 0.5s ease',
                }}
              >
                <SphereNode
                  track={n.track}
                  importance={n.importance}
                  radius={n.radius}
                  color={n.color}
                  isPlaying={isPlaying}
                  isAnyPlaying={playingId !== null}
                  alreadyMinted={mintedIds.has(n.track.week)}
                  onMinted={onMinted}
                  onTogglePlay={() => {
                    if (n._dragged) return;
                    toggle(n.track);
                  }}
                />
              </g>
            );
          })}
        </g>
      </g>
    </svg>
    <EclipseLayer zoomGRef={eclipseZoomGRef} eclipseGRef={eclipseGRef} />
    </>
  );
}
