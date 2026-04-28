'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceLink,
  type Simulation,
} from 'd3-force';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import type { Track } from '@/src/types/tracks';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import SphereNode from './SphereNode';
import {
  CFG,
  computeNodeAttrs,
  generateLinks,
  type SimNode,
  type SimLink,
} from './sphere-config';

/**
 * Phase 6 B2.1 v2 — 完整复现 sound-spheres 的 force-directed canvas
 *
 * 物理参数严格按 references/sound-spheres.html line 731-748：
 * - alphaDecay 0.016 + velocityDecay 0.4（默认衰减让 sim 收敛，不会飞出屏幕）
 * - charge 按 importance 缩放：-(CHARGE * (0.6 + imp * 0.8))
 * - collide radius * 1.06 + 8（紧凑布局）
 * - center strength 0.05（轻拉中心）
 * - forceLink 即使不渲染 line，作为节点间稳定力
 *
 * "永远可拖" = drag start 自动重启 sim（sound-spheres 同款），不靠 alphaTarget=0.05
 * 微调 2（播放透明度）：playingId 切换时其他节点 opacity → 0
 *
 * 配置 / 节点生成 / link 生成抽到 sphere-config.ts，本文件只保留 React + D3 effect。
 */

interface Props {
  tracks: Track[];
  mintedIds: Set<number>;
  onMinted: (tokenId: number) => void;
}

export default function SphereCanvas({ tracks, mintedIds, onMinted }: Props) {
  const { playing, currentTrack, toggle } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;

  const simNodes = useMemo<SimNode[]>(
    () => tracks.map((t) => ({ id: t.id, track: t, ...computeNodeAttrs(t) })),
    [tracks],
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);

  useEffect(() => {
    if (!svgRef.current || simNodes.length === 0) return;

    const W = svgRef.current.clientWidth || 800;
    const H = svgRef.current.clientHeight || 600;
    const cx = W / 2;
    const cy = H / 2;

    // 初始位置：圆心附近随机散开
    simNodes.forEach((n) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 100;
      n.x = cx + Math.cos(angle) * dist;
      n.y = cy + Math.sin(angle) * dist;
      n.vx = 0;
      n.vy = 0;
      delete n.fx;
      delete n.fy;
    });

    const links = generateLinks(simNodes);

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => CFG.linkBaseDist + (1 - d.correlation) * CFG.linkVariance)
          .strength((d) => d.correlation * 0.30),
      )
      .force(
        'charge',
        forceManyBody<SimNode>().strength(
          (d) => -(CFG.charge * (0.6 + d.importance * 0.8)),
        ),
      )
      .force(
        'collide',
        forceCollide<SimNode>()
          .radius((d) => d.radius * 1.06 + 8)
          .strength(0.85)
          .iterations(4),
      )
      .force('center', forceCenter(cx, cy).strength(0.05))
      .alphaDecay(0.016)
      .velocityDecay(0.4)
      .on('tick', () => {
        simNodes.forEach((n, i) => {
          const el = nodeRefs.current[i];
          if (el && n.x != null && n.y != null) {
            el.setAttribute('transform', `translate(${n.x},${n.y})`);
          }
        });
      });

    simRef.current = sim;

    // Drag 行为照抄 sound-spheres line 661-679（区分 click vs drag + 永远可拖）
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on('start', (e, d) => {
        d._dragged = false;
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (e, d) => {
        if (!d._dragged) {
          d._dragged = true;
          if (!e.active) sim.alphaTarget(0.08).restart();
        }
        d.fx = e.x;
        d.fy = e.y;
      })
      .on('end', (e, d) => {
        if (!e.active) sim.alphaTarget(0);
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
              importance={n.importance}
              radius={n.radius}
              color={n.color}
              isPlaying={isPlaying}
              alreadyMinted={mintedIds.has(n.track.week)}
              onMinted={onMinted}
              onTogglePlay={() => {
                // 拖动后的"伪点击"不触发播放（sound-spheres line 700）
                if (n._dragged) return;
                toggle(n.track);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
