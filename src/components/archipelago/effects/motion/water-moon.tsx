'use client';
// Phase 8-B §2.15 waterMoon — 水中月
// 月亮从"挂天上"改"落水里"：播放球附近水面月影（radialGradient 光斑 + 2-3 横向暗带切割
// 做出波纹碎月感 + 极慢呼吸）。z 层挂在球群 SVG 之下（本组件由 SphereCanvas 渲染在
// sphere <g> 之前，且置于 zoomG 内随滚轮缩放镜像 = 水面层）。日食旧形态由 EclipseLayer 保留。
import { useEffect, useRef } from 'react';
import type { SimNode } from '../../sphere-config';
import { getPondTilt } from '../../hooks/pond/use-pond-tilt';

interface Props {
  simNodesRef: React.RefObject<SimNode[]>;
  playingId: string | null;
}

export default function WaterMoon({ simNodesRef, playingId }: Props) {
  const gRef = useRef<SVGGElement>(null);
  const playingRef = useRef<string | null>(playingId);
  useEffect(() => { playingRef.current = playingId; }, [playingId]);

  // rAF：跟随播放球位置（读 simNodesRef，自包含，不接 Lane B 渲染管线）。
  useEffect(() => {
    let raf = 0, cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const g = gRef.current;
      const pid = playingRef.current;
      if (g) {
        const pn = pid ? (simNodesRef.current ?? []).find((n) => n.id === pid) : null;
        if (pn && pn.x != null && pn.y != null) {
          const tilt = getPondTilt();
          const s = (pn.radius ?? 30) / 30;
          // 月影压扁（机位）+ 跟随播放球
          g.setAttribute('transform', `translate(${pn.x},${pn.y}) scale(${s},${s * tilt})`);
          g.style.display = 'block';
        } else {
          g.style.display = 'none';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [simNodesRef]);

  return (
    <g ref={gRef} aria-hidden="true" style={{ display: 'none', pointerEvents: 'none' }}>
      <defs>
        <radialGradient id="water-moon-glow">
          <stop offset="0%" stopColor="var(--pond-light)" stopOpacity="0.55" />
          <stop offset="45%" stopColor="var(--pond-light)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--pond-light)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 极慢呼吸由 CSS keyframe water-moon-breathe（Lane E 区块）驱动，只动 transform/opacity */}
      <g className="water-moon-breathe">
        <ellipse rx={110} ry={110} fill="url(#water-moon-glow)" />
        {/* 2-3 条横向暗带切割 — 波纹碎月感（pond-bg 系，半透明压暗光斑） */}
        <rect x={-110} y={-14} width={220} height={7} fill="var(--pond-bg)" opacity={0.5} />
        <rect x={-110} y={2} width={220} height={5} fill="var(--pond-bg)" opacity={0.4} />
        <rect x={-110} y={16} width={220} height={6} fill="var(--pond-bg)" opacity={0.45} />
      </g>
    </g>
  );
}
