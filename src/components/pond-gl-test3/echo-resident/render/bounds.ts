import type { ResidentEchoBounds, ResidentEchoConfig, ResidentEchoLayout, ResidentPoint, ResidentRect } from '../../../../types/echo-resident';

const finite = (n: number, fallback = 0) => Number.isFinite(n) ? n : fallback;
export function contains(rect: ResidentRect, point: ResidentPoint): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}
function selectRegion(layout: ResidentEchoLayout, c: ResidentEchoConfig, radius: number, current?: ResidentPoint): ResidentRect | null {
  const s = layout.safeArea;
  const x = c.edgeMarginPx + Math.max(0, finite(s.left)) + radius;
  const y = c.edgeMarginPx + Math.max(0, finite(s.top)) + radius;
  const width = finite(layout.width) - x - c.edgeMarginPx - Math.max(0, finite(s.right)) - radius;
  const height = finite(layout.height) - y - c.edgeMarginPx - Math.max(0, finite(s.bottom)) - radius;
  if (width < 0 || height < 0) return null;
  let regions: ResidentRect[] = [{ x, y, width, height }];
  for (const control of layout.controls) {
    if (![control.x, control.y, control.width, control.height].every(Number.isFinite)) continue;
    const margin = c.controlMarginPx + radius;
    const b = { x: control.x - margin, y: control.y - margin,
      width: Math.max(0, control.width) + margin * 2, height: Math.max(0, control.height) + margin * 2 };
    regions = regions.flatMap((r) => {
      const left = Math.max(r.x, b.x), top = Math.max(r.y, b.y);
      const right = Math.min(r.x + r.width, b.x + b.width), bottom = Math.min(r.y + r.height, b.y + b.height);
      if (left >= right || top >= bottom) return [r];
      return [
        { x: r.x, y: r.y, width: r.width, height: top - r.y },
        { x: r.x, y: bottom, width: r.width, height: r.y + r.height - bottom },
        { x: r.x, y: r.y, width: left - r.x, height: r.height },
        { x: right, y: r.y, width: r.x + r.width - right, height: r.height },
      ].filter((v) => v.width > 0 && v.height > 0);
    });
    // 每次分割最多保留 64 块候选，不会随 UI 数量指数增长。
    regions.sort((a, b) => Number(!!current && contains(b, current)) - Number(!!current && contains(a, current))
      || b.width * b.height - a.width * a.height || a.y - b.y || a.x - b.x);
    regions = regions.slice(0, 64);
    if (!regions.length) return null;
  }
  return regions[0] ?? null;
}
/** 先找完整包围盒可驻留的空矩形；只有极端短屏才有界缩小尺寸。 */
export function resolveResidentBounds(layout: ResidentEchoLayout, c: ResidentEchoConfig, current?: ResidentPoint): ResidentEchoBounds {
  const body = Math.max(0, finite(layout.baseRadiusPx)) * c.diameterMultiplier * c.breathScale[1]
    * Math.max(1, finite(layout.maxProjectionScale, 1.5));
  const halo = body * Math.max(1, finite(layout.haloRatio, 1.16));
  const envelope = halo + c.focusRingPx;
  let sizeScale = 1;
  let rect = selectRegion(layout, c, envelope, current);
  if (!rect) {
    let low = 0, high = 1;
    for (let i = 0; i < 16; i++) {
      const mid = (low + high) / 2;
      if (selectRegion(layout, c, halo * mid + c.focusRingPx, current)) low = mid;
      else high = mid;
    }
    sizeScale = low;
    rect = selectRegion(layout, c, halo * low + c.focusRingPx, current);
  }
  return { rect: rect ?? { x: Math.max(0, finite(layout.width)) / 2,
    y: Math.max(0, finite(layout.height)) / 2, width: 0, height: 0 },
    sizeScale: rect && body > 0 ? sizeScale : 0, sizeClamped: sizeScale < 1 || !rect,
    envelopeRadiusPx: rect ? halo * sizeScale + c.focusRingPx : 0 };
}
