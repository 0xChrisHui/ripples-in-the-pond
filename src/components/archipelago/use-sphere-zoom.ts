'use client';

import { useEffect } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { type Simulation } from 'd3-force';
import { type SimNode, type SimLink } from './sphere-config';

/**
 * d3.zoom 行为接到 svg：滚轮缩放 + 双击 reset + Escape reset。
 * 主 zoomG 与日食层 eclipseZoomG 共享同一 transform，确保日食与球同步。
 *
 * v20：zoom k > 1.4 时让 sim alphaTarget = 0（停止 sphere jitter）。
 * 放大状态下减少持续 paint，缓解 ripple/glow 渲染叠加导致的闪烁。
 */
export function useSphereZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  zoomGRef: React.RefObject<SVGGElement | null>,
  eclipseZoomGRef: React.RefObject<SVGGElement | null>,
  simRef: React.RefObject<Simulation<SimNode, SimLink> | null>,
): void {
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
        // v20：放大停 jitter（节约 paint）
        if (simRef.current) {
          simRef.current.alphaTarget(e.transform.k > 1.4 ? 0 : 0.008);
        }
      });

    svgSel.call(zoomBehavior);
    svgSel.on('dblclick.zoom', null).on('dblclick', () => {
      svgSel.call(zoomBehavior.transform, zoomIdentity);
    });

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
