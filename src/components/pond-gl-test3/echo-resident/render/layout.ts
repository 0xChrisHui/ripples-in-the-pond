import type { ResidentEchoLayout } from '../../../../types/echo-resident';

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
/** 异常布局保留有限、可检查的几何；零面积/零半径由 bounds 禁用命中。 */
export function normalizeResidentLayout(layout: ResidentEchoLayout): ResidentEchoLayout {
  const p = layout.projection, s = layout.safeArea;
  const width = Math.max(0, finite(layout.width, 0)), height = Math.max(0, finite(layout.height, 0));
  return { ...layout, width, height,
    baseRadiusPx: Math.max(0, finite(layout.baseRadiusPx, 0)),
    maxProjectionScale: Math.max(p.perspective ? 1.5 : 1, finite(layout.maxProjectionScale, 1.5)),
    haloRatio: Math.max(1, finite(layout.haloRatio, 1.16)), surface: finite(layout.surface, 0.525),
    safeArea: { top: Math.max(0, finite(s.top, 0)), bottom: Math.max(0, finite(s.bottom, 0)),
      left: Math.max(0, finite(s.left, 0)), right: Math.max(0, finite(s.right, 0)) },
    projection: { ...p, cx: finite(p.cx, width / 2), cy: finite(p.cy, height / 2),
      mx: finite(p.mx, 0), my: finite(p.my, 0), focusZ: finite(p.focusZ, 0.525) },
  };
}
