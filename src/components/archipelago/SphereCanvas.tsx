'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceCenter,
  type Simulation,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import type { Track } from '@/src/types/tracks';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import SphereNode, { NODE_R } from './SphereNode';

/**
 * Phase 6 B2.1 — sound-spheres 风格的 force-directed canvas
 *
 * 基于 references/sound-spheres.html 的视觉系统重写：
 * - SVG + d3-force 物理仿真
 * - React 渲染节点结构，D3 每 tick 直接改 g.transform（不走 React state，性能好）
 * - 微调 1：alphaDecay=0 + alphaTarget=0.05，sim 永不衰减 → 圆圈永远可拖
 * - 微调 2：playingId 切换时其他节点 opacity 渐隐到 0（视觉聚焦）
 * - 节点视觉 + useFavorite 拆到 SphereNode.tsx（220 行硬线）
 */

interface SimNode {
  id: string;
  track: Track;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Props {
  tracks: Track[];
  mintedIds: Set<number>;
  onMinted: (tokenId: number) => void;
}

export default function SphereCanvas({ tracks, mintedIds, onMinted }: Props) {
  const { playing, currentTrack, toggle } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;

  // 把 tracks 包装成 SimNode（D3 会修改 x/y/vx/vy/fx/fy 字段）
  const simNodes = useMemo<SimNode[]>(
    () => tracks.map((t) => ({ id: t.id, track: t })),
    [tracks],
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);

  useEffect(() => {
    if (!svgRef.current || simNodes.length === 0) return;

    const W = svgRef.current.clientWidth || 800;
    const H = svgRef.current.clientHeight || 600;
    const cx = W / 2;
    const cy = H / 2;

    // 初始位置：圆心附近随机散开
    simNodes.forEach((n) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 200;
      n.x = cx + Math.cos(angle) * dist;
      n.y = cy + Math.sin(angle) * dist;
      n.vx = 0;
      n.vy = 0;
    });

    const sim = forceSimulation<SimNode>(simNodes)
      .force('charge', forceManyBody().strength(-280))
      .force(
        'collide',
        forceCollide<SimNode>()
          .radius(NODE_R * 1.3)
          .strength(0.85)
          .iterations(4),
      )
      .force('center', forceCenter(cx, cy).strength(0.05))
      .alphaDecay(0) // 微调 1：永不衰减
      .velocityDecay(0.6)
      .alphaTarget(0.05) // 保持微弱活动 → 圆圈永远可拖
      .on('tick', () => {
        simNodes.forEach((n, i) => {
          const el = nodeRefs.current[i];
          if (el && n.x != null && n.y != null) {
            el.setAttribute('transform', `translate(${n.x},${n.y})`);
          }
        });
      });

    simRef.current = sim;

    // Drag — 拖动时短暂提高 alpha，松开后回到 baseline 0.05（不停）
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on('start', (e, d) => {
        if (!e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (e, d) => {
        d.fx = e.x;
        d.fy = e.y;
      })
      .on('end', (e, d) => {
        if (!e.active) sim.alphaTarget(0.05);
        d.fx = null;
        d.fy = null;
      });

    nodeRefs.current.forEach((el, i) => {
      if (el) {
        select<SVGGElement, SimNode>(el).datum(simNodes[i]).call(dragBehavior);
      }
    });

    return () => {
      sim.stop();
    };
  }, [simNodes]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full cursor-grab active:cursor-grabbing"
    >
      {simNodes.map((n, i) => {
        const dimmed = playingId !== null && playingId !== n.track.id;
        const isPlaying = playingId === n.track.id;
        return (
          <g
            key={n.id}
            ref={(el) => {
              nodeRefs.current[i] = el;
            }}
            style={{
              opacity: dimmed ? 0 : 1,
              transition: 'opacity 0.5s ease',
            }}
          >
            <SphereNode
              track={n.track}
              isPlaying={isPlaying}
              alreadyMinted={mintedIds.has(n.track.week)}
              onMinted={onMinted}
              onTogglePlay={() => toggle(n.track)}
            />
          </g>
        );
      })}
    </svg>
  );
}
