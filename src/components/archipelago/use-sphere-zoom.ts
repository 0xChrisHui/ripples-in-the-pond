'use client';

import { useEffect } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';

/**
 * d3.zoom 行为接到 svg：滚轮缩放 + 双击 reset + Escape reset。
 * 主 zoomG 与日食层 eclipseZoomG 共享同一 transform，确保日食与球同步。
 */
export function useSphereZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  zoomGRef: React.RefObject<SVGGElement | null>,
  eclipseZoomGRef: React.RefObject<SVGGElement | null>,
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
