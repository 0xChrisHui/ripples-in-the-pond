'use client';

import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { type Simulation } from 'd3-force';
import { type SimNode, type SimLink } from './sphere-config';

/**
 * d3.zoom 行为接到 svg：滚轮缩放 + Escape reset（v27 取消 dblclick reset）。
 * 主 zoomG 与日食层 eclipseZoomG 共享同一 transform，确保日食与球同步。
 *
 * v20：zoom k > 1.4 时让 sim alphaTarget = 0（停止 sphere jitter）。
 * v33 修：alphaTarget 改 0.003（接近 0 但 sim 仍低频 tick），让涟漪推球在缩放
 *       状态下仍生效；CSS .zoom-large 保留（暂停最贵的 ripple SVG animation）。
 *       仅在 big 状态切换时 alpha(0.1).restart()，避免每次 zoom event 频繁踢 sim。
 */
export function useSphereZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  zoomGRef: React.RefObject<SVGGElement | null>,
  eclipseZoomGRef: React.RefObject<SVGGElement | null>,
  simRef: React.RefObject<Simulation<SimNode, SimLink> | null>,
): void {
  const lastBigRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!svgRef.current || !zoomGRef.current) return;
    const svgSel = select(svgRef.current);
    const zoomG = select(zoomGRef.current);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (e) => {
        const t = e.transform.toString();
        zoomG.attr('transform', t);
        if (eclipseZoomGRef.current) {
          eclipseZoomGRef.current.setAttribute('transform', t);
        }
        // v35 — 阈值 1.4 → 2.5：常用缩放范围内不冻结 sphere ripple
        const big = e.transform.k > 2.5;
        if (simRef.current && big !== lastBigRef.current) {
          // 状态切换时 alpha(0.1).restart() 让 sim 平滑过渡
          simRef.current.alphaTarget(big ? 0.003 : 0.008).alpha(0.1).restart();
          lastBigRef.current = big;
        }
        zoomG.classed('zoom-large', big);
      });

    svgSel.call(zoomBehavior);
    // v27 — 取消 dblclick reset：快速点击触发涟漪时不应重置 zoom（保留 Escape reset）
    svgSel.on('dblclick.zoom', null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        svgSel.call(zoomBehavior.transform, zoomIdentity);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
