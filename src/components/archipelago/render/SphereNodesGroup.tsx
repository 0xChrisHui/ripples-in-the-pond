'use client';
// 球节点组 — 从 SphereCanvas 抽出守 220 行硬线。
// Lane E tide：球群套独立 wrapper <g class="tide-breathe">（flag 开时挂 CSS scale 呼吸 keyframe），
// 不写 zoomG / sim 外层 g 的 transform（两者各有专属归属，见 8-F F1 transform 硬规定）。
import type { SimNode } from '../sphere-config';
import type { EffectsConfig } from '../effects-config';
import SphereNode from '../SphereNode';

interface Props {
  sortedNodes: SimNode[];
  playingId: string | null;
  anyPlaying: boolean;
  zMap: Map<string, number>;
  mintedIds: Set<number>;
  onMinted: (tokenId: number) => void;
  nodeRefMap: React.RefObject<Map<string, SVGGElement>>;
  effects: EffectsConfig;
  onTogglePlay: (n: SimNode) => void;
}

export default function SphereNodesGroup({
  sortedNodes, playingId, anyPlaying, zMap, mintedIds, onMinted,
  nodeRefMap, effects, onTogglePlay,
}: Props) {
  return (
    <g className={effects.tide ? 'tide-breathe' : undefined}>
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
              // v87 G2 — contain: layout style 给浏览器 isolation 提示，重绘时不污染邻居
              contain: 'layout style',
            }}>
            <SphereNode
              track={n.track} importance={n.importance} radius={n.radius}
              color={n.color}
              isPlaying={isPlaying} isAnyPlaying={anyPlaying}
              alreadyMinted={mintedIds.has(n.track.week)} onMinted={onMinted}
              onTogglePlay={() => {
                if (n._dragged) return;
                onTogglePlay(n);
              }}
              effects={effects}
            />
          </g>
        );
      })}
    </g>
  );
}
