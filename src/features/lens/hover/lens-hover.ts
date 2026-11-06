import { pickCircle, type Circle } from '../lens-geometry';

/** 悬停面板的状态：当前显示哪个球、正在争取切换到哪个球、离开球的时刻。 */
export type HoverState = {
  shown: string | null;
  candidate: string | null;
  since: number;
  leftAt: number | null;
};

export const HOVER_IDLE: HoverState = { shown: null, candidate: null, since: 0, leftAt: null };

/** 指针要在新球上停留这么久才切换：快速扫过密集区不换框。 */
export const SWITCH_DWELL_MS = 130;
/** 离开球且不在面板上后，面板再撤下前的宽限：跨过密集区里球与球之间的空隙，不在空隙里合上再开。 */
export const LEAVE_GRACE_MS = 320;
/** 已显示的球：指针在它半径的这个倍数内仍算“还在它上面”，盖住相邻球时不抖。 */
export const HOLD_SCALE = 1.2;
/** 密集区空隙：指针落在已显示球附近的这个倍数半径内、且没有命中别的球，面板保持不动（不合上再开）。 */
export const NEIGHBOR_SCALE = 3;

export type HoverInput = {
  now: number;
  /** null = 没有鼠标指针（触屏、鼠标离开窗口）。 */
  pointer: { x: number; y: number } | null;
  circles: Circle[];
  /** 指针或键盘焦点在面板内：面板保持原目标，不再根据底下的球切换。 */
  inPanel: boolean;
  /** 有鼠标、但它离开了页面（去操作 MetaMask 等独立窗口、切到别的程序）；触屏没有鼠标，不算。 */
  away?: boolean;
};

/** 离开、保持、切换三种结果都要清掉“正在争取”的状态，抽出来避免重复。 */
function settle(prev: HoverState): HoverState {
  return prev.candidate || prev.leftAt != null ? { ...prev, candidate: null, leftAt: null } : prev;
}

/**
 * 每帧推进一次悬停状态（纯函数）。
 * - 面板上：保持不动。
 * - 已显示的球：指针仍在其 HOLD 范围内则不切换（盖住相邻球时不抖）。
 * - 切换：新球需连续停留 SWITCH_DWELL_MS 才换，扫过去的球不会触发。
 * - 离开：缝隙或 #36 上超过 LEAVE_GRACE_MS 才撤下；鼠标离开页面（away）则保持不动；触屏无鼠标仍按旧规则撤下。
 */
export function stepHover(prev: HoverState, input: HoverInput): HoverState {
  const { now, pointer, circles, inPanel, away } = input;
  if (inPanel) return settle(prev);
  // 鼠标离开了页面（去操作 MetaMask 等独立窗口）：没有"悬停变化"，面板保持原样，
  // 等鼠标回到页面再按位置决定。否则铸造中弹出钱包窗口，面板会被当作"鼠标已离开"而撤下。
  if (away && prev.shown) return settle(prev);
  const shown = prev.shown ? circles.find((c) => c.id === prev.shown) ?? null : null;
  const held = !!shown && !!pointer
    && Math.hypot(pointer.x - shown.x, pointer.y - shown.y) <= shown.r * HOLD_SCALE;
  if (held) return settle(prev);
  const hit = pointer ? pickCircle(circles, pointer.x, pointer.y) : null;
  if (hit && !hit.echo) {
    if (hit.id === prev.shown) return settle(prev);
    if (prev.candidate !== hit.id) return { shown: prev.shown, candidate: hit.id, since: now, leftAt: null };
    if (now - prev.since < SWITCH_DWELL_MS) return prev.leftAt != null ? { ...prev, leftAt: null } : prev;
    return { shown: hit.id, candidate: null, since: 0, leftAt: null };
  }
  if (!prev.shown) return HOVER_IDLE; // 本来就没显示：没有需要宽限的东西
  // 空隙：仍在已显示球的邻近范围内 → 保持，不计时（密集区扫动时面板不合上）
  if (shown && pointer && Math.hypot(pointer.x - shown.x, pointer.y - shown.y) <= shown.r * NEIGHBOR_SCALE) {
    return settle(prev);
  }
  const leftAt = prev.leftAt ?? now;
  if (now - leftAt >= LEAVE_GRACE_MS) return HOVER_IDLE;
  return { ...prev, candidate: null, leftAt };
}
