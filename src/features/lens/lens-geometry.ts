/** /lens 的纯几何：选球、光圈缓动、面板摆放（无 DOM 依赖，便于单测）。 */
export type Circle = { id: string; x: number; y: number; r: number; echo: boolean };
export type Viewport = { w: number; h: number; topInset: number };
export type Side = 'right' | 'left' | 'below' | 'above';
/** maxH：面板比可用空间高时的高度上限（内部滚动），保证面板不盖住球。 */
export type Placement = { left: number; top: number; side: Side; maxH?: number };

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
const MIN_SCROLL_ROOM = 160;

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
  // 完整放不下（手机竖屏、面板很高）：取上/下空间较大的一侧，压低面板高度并内部滚动，绝不盖住球。
  const roomBelow = v.h - (anchor.y + anchor.r + GAP) - EDGE;
  const roomAbove = anchor.y - anchor.r - GAP - (v.topInset + EDGE);
  const below = roomBelow >= roomAbove;
  const room = Math.max(roomBelow, roomAbove);
  const left = Math.min(Math.max(anchor.x - size.w / 2, EDGE), Math.max(EDGE, v.w - size.w - EDGE));
  if (room >= MIN_SCROLL_ROOM) {
    return below ? { left, top: anchor.y + anchor.r + GAP, side: 'below', maxH: room }
      : { left, top: v.topInset + EDGE, side: 'above', maxH: room };
  }
  // 极小视口：贴底部居中，保证不越界。
  return {
    left: Math.max(EDGE, (v.w - size.w) / 2),
    top: Math.max(v.topInset + EDGE, v.h - size.h - EDGE),
    side: 'below',
  };
}

/**
 * 光圈瞄准点（纯函数）：选中 / 锁定 → 球心；有过指针 → 最后位置夹到视口内；从未有过指针 → 画面中心。
 * 指针离开窗口时调用方仍传入最后位置，因此光圈停在边缘，不会回中心再弹回来。
 */
export function ringAim(pointer: { x: number; y: number; has: boolean } | null, pinned: Circle | null,
  w: number, h: number): { x: number; y: number } {
  if (pinned) return { x: pinned.x, y: pinned.y };
  if (!pointer?.has) return { x: w / 2, y: h / 2 };
  return { x: Math.min(Math.max(pointer.x, 0), w), y: Math.min(Math.max(pointer.y, 0), h) };
}
