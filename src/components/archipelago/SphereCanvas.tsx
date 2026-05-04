'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { type Simulation } from 'd3-force';
import type { Track } from '@/src/types/tracks';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import SphereNode from './SphereNode';
import SphereGlowDefs from './SphereGlowDefs';
import EclipseLayer from './EclipseLayer';
import {
  buildClusterAssignment,
  computeNodeAttrs,
  fLayer,
  generateLinks,
  getGroupTargetCount,
  getGroupTracks,
  halton,
  hashStr,
  NUM_LAYERS,
  padTracksToTarget,
  type GroupId,
  type SimNode,
  type SimLink,
} from './sphere-config';
import { useSphereZoom } from './hooks/use-sphere-zoom';
import { useSphereZ } from './hooks/use-sphere-z';
import { useWaveEvents } from './hooks/use-wave-events';
import { useMouseTilt } from './hooks/use-mouse-tilt';
import { useSphereSim } from './hooks/use-sphere-sim';
import CometSystem from './effects/motion/comet-system';
import type { EffectsConfig } from './effects-config';


interface Props {
  tracks: Track[];
  currentGroupId: GroupId;
  mintedIds: Set<number>;
  onMinted: (tokenId: number) => void;
  effects: EffectsConfig;
}

export default function SphereCanvas({
  tracks, currentGroupId, mintedIds, onMinted, effects,
}: Props) {
  const { playing, currentTrack, toggle } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;

  const tracksToShow = useMemo<Track[]>(
    () => padTracksToTarget(getGroupTracks(currentGroupId, tracks), getGroupTargetCount(currentGroupId)),
    [tracks, currentGroupId],
  );

  const [simData, setSimData] = useState<{
    nodes: SimNode[];
    links: SimLink[];
    assignment: Map<string, number>;
    clusterCount: number;
  }>({ nodes: [], links: [], assignment: new Map(), clusterCount: 0 });

  useEffect(() => {
    const baseNodes = tracksToShow.map((t) => ({
      id: t.id, track: t,
      ...computeNodeAttrs(t, currentGroupId),
    }));
    const { assignment, clusterCount } = buildClusterAssignment(baseNodes.map((n) => n.id));
    // v86 — baseLayer 由 z 派生（与 useSphereZ 同公式），保证 layer/tilt/focus/perspective 远近一致
    const clusterZ = Array.from({ length: clusterCount }, (_, i) => halton(i + 1, 5));
    const nodes = baseNodes.map((n) => {
      const baseZ = clusterZ[assignment.get(n.id) ?? 0] ?? 0.5;
      const h = hashStr(n.id);
      const z = Math.max(0, Math.min(1, baseZ + ((h % 601) / 1000) - 0.3));
      const baseLayer = Math.max(1, Math.min(NUM_LAYERS, Math.round((1 - z) * (NUM_LAYERS - 1) + 1)));
      const lw = { amp: 0.6 + Math.random() * 0.8, f1: 0.04 + Math.random() * 0.08, f2: 0.10 + Math.random() * 0.15, p1: Math.random() * 6.283, p2: Math.random() * 6.283 };
      return { ...n, baseLayer, lw, radius: n.kSize * fLayer(baseLayer) };
    });
    const links = generateLinks(nodes, assignment);
    // queueMicrotask 避 React 19 react-hooks/set-state-in-effect lint（同 B1 c749b67 pattern）
    queueMicrotask(() => setSimData({ nodes, links, assignment, clusterCount }));
  }, [tracksToShow, currentGroupId]);

  const { nodes: simNodes, links: simLinks, assignment, clusterCount } = simData;
  const { zMap, sortedNodes } = useSphereZ(simNodes, assignment, clusterCount);

  const simNodesRef = useRef<SimNode[]>([]);
  useEffect(() => { simNodesRef.current = simNodes; }, [simNodes]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGRef = useRef<SVGGElement | null>(null);
  const nodeRefMap = useRef<Map<string, SVGGElement>>(new Map());
  const lineRefs = useRef<(SVGElement | null)[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const eclipseZoomGRef = useRef<SVGGElement | null>(null);
  const eclipseGRef = useRef<SVGGElement | null>(null);
  const ghostRefMap = useRef<Map<string, SVGCircleElement>>(new Map());
  const playingIdRef = useRef<string | null>(null);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  const [cometEclipseActive, setCometEclipseActive] = useState(false);
  useEffect(() => {
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ active: boolean }>;
      setCometEclipseActive(ce.detail.active);
    };
    window.addEventListener('comet:eclipse-changed', onChange);
    return () => window.removeEventListener('comet:eclipse-changed', onChange);
  }, []);
  const anyPlaying = playingId !== null || cometEclipseActive;

  const wavesRef = useWaveEvents();
  const { ref: mouseRef, insideRef: mouseInsideRef } = useMouseTilt();
  const { zoomKRef, vanishRef } = useSphereZoom(svgRef, zoomGRef, eclipseZoomGRef, simRef, nodeRefMap, simNodesRef, effects);

  useSphereSim({
    svgRef, simNodes, simLinks, assignment, clusterCount, zMap,
    nodeRefMap, lineRefs, eclipseGRef, ghostRefMap,
    wavesRef, mouseRef, mouseInsideRef, zoomKRef, vanishRef, playingIdRef,
    effects, simRef,
  });

  return (
    <>
    <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing">
      <SphereGlowDefs />
      {/* 彗星日食模式光晕 */}
      <defs>
        <radialGradient id="comet-halo">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="22%" stopColor="white" stopOpacity="0" />
          <stop offset="24%" stopColor="white" stopOpacity="0.55" />
          <stop offset="36%" stopColor="white" stopOpacity="0.32" />
          <stop offset="60%" stopColor="white" stopOpacity="0.10" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {effects.comet && (
        <CometSystem
          simNodes={simNodes} zMap={zMap} svgRef={svgRef}
          zoomKRef={zoomKRef} vanishRef={vanishRef}
          perspective={effects.perspective} anyEclipse={anyPlaying}
          playingId={playingId} focus={effects.focus}
        />
      )}
      <g ref={zoomGRef} style={{ willChange: 'transform' }}>
        <g style={{ opacity: anyPlaying ? 0 : 1, transition: 'opacity 0.5s ease', pointerEvents: 'none' }}>
          {simLinks.map((l, i) => {
            const src = simNodes.find((n) => n.id === (typeof l.source === 'string' ? l.source : (l.source as SimNode).id));
            const stroke = src?.color ?? '#888';
            const sw = 0.4 + l.correlation * 1.4;
            const so = 0.05 + l.correlation * 0.13;
            return (
              <line
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                stroke={stroke}
                strokeWidth={sw}
                strokeOpacity={so}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}
        </g>
        <g>
          {sortedNodes.map((n) => {
            const isPlaying = playingId === n.track.id;
            const dimmed = anyPlaying && !isPlaying;
            const z = zMap.get(n.id) ?? 0.5;
            return (
              <g key={n.id} data-z={z}
                ref={(el) => {
                  if (el) nodeRefMap.current.set(n.id, el);
                  else nodeRefMap.current.delete(n.id);
                }}
                style={{
                  opacity: dimmed ? 0 : 1,
                  // v87 perf — 删 transition: filter。filter 在 sim tick 每帧改，
                  // CSS transition 反而强制每帧插值 + 离屏 GPU layer 重做，是 FPS 杀手。
                  transition: 'opacity 0.5s ease',
                  // v87 G2 — contain: layout style 给浏览器 isolation 提示，
                  // 重绘时不污染邻居（不用 paint 因为会裁剪 glow halo）
                  contain: 'layout style',
                }}>
                <SphereNode
                  track={n.track} importance={n.importance} radius={n.radius}
                  color={n.color}
                  isPlaying={isPlaying} isAnyPlaying={anyPlaying}
                  alreadyMinted={mintedIds.has(n.track.week)} onMinted={onMinted}
                  onTogglePlay={() => {
                    if (n._dragged) return;
                    toggle(n.track);
                  }}
                  effects={effects}
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
