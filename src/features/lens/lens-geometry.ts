/** /lens 的纯几何：选球、光圈缓动、面板摆放（无 DOM 依赖，便于单测）。 */
export type Circle = { id: string; x: number; y: number; r: number; echo: boolean };
export type Viewport = { w: number; h: number; topInset: number };
export type Side = 'right' | 'left' | 'below' | 'above';
export type Placement = { left: number; top: number; side: Side };

/** 光圈（指针）落在哪个球上：多球重叠取「离圆心最近（按半径归一）」的那个。 */
export function pickCircle(circles: Circle[], px: number, py: number, tolerance = 0): Circle | null {
  let best: Circle | null = null;
  let bestScore = Infinity;
  for (const circle of circles) {
    const dist = Math.hypot(px - circle.x, py - circle.y);
    if (dist > circle.r + tolerance) continue;
    const score = dist / Math.max(circle.r, 1);
    if (score < bestScore) { best = circle; bestScore = score; }
  }
  return best;
}

/** 指数缓动：与帧率无关；tau 越小越跟手，tau<=0 直接到位。 */
export function easeToward(current: number, target: number, dtMs: number, tauMs: number): number {
  if (tauMs <= 0) return target;
  const k = 1 - Math.exp(-Math.max(dtMs, 0) / tauMs);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.05 ? target : next;
}

const GAP = 14;
const EDGE = 12;

function fit(side: Side, a: Circle, w: number, h: number, v: Viewport): Placement | null {
  let left = 0, top = 0;
  if (side === 'right') { left = a.x + a.r + GAP; top = a.y - h / 2; }
  else if (side === 'left') { left = a.x - a.r - GAP - w; top = a.y - h / 2; }
  else if (side === 'below') { left = a.x - w / 2; top = a.y + a.r + GAP; }
  else { left = a.x - w / 2; top = a.y - a.r - GAP - h; }
  const minTop = v.topInset + EDGE;
  const maxTop = v.h - h - EDGE;
  const crossFits = side === 'right' || side === 'left' ? maxTop >= minTop : true;
  // 主轴必须完整放得下；交叉轴允许贴边夹紧（不越出画面、不压顶栏）。
  const mainFits = side === 'right' ? left + w <= v.w - EDGE
    : side === 'left' ? left >= EDGE
      : side === 'below' ? top + h <= v.h - EDGE : top >= minTop;
  if (!mainFits || !crossFits) return null;
  const clampedLeft = Math.min(Math.max(left, EDGE), Math.max(EDGE, v.w - w - EDGE));
  const clampedTop = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));
  return { left: clampedLeft, top: clampedTop, side };
}

/** 右、左、下、上择优；已在某侧且仍放得下就不换（避免球漂动时来回翻面）。 */
export function placePanel(anchor: Circle, size: { w: number; h: number }, v: Viewport, prefer?: Side): Placement {
  const order: Side[] = ['right', 'left', 'below', 'above'];
  if (prefer) { order.splice(order.indexOf(prefer), 1); order.unshift(prefer); }
  for (const side of order) {
    const hit = fit(side, anchor, size.w, size.h, v);
    if (hit) return hit;
  }
  // 都放不下（极小视口）：贴底部居中，保证不越界。
  return {
    left: Math.max(EDGE, (v.w - size.w) / 2),
    top: Math.max(v.topInset + EDGE, v.h - size.h - EDGE),
    side: 'below',
  };
}
