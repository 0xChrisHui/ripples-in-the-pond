'use client';
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { easeToward, pickCircle, placePanel, type Circle, type Side } from './lens-geometry';
import type { LensPointer } from './use-lens-pointer';

export type LensSelection = { id: string; source: 'tap' | 'deeplink' | 'key' } | null;

type Args = {
  active: boolean;
  reduced: boolean;
  veilRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  pointerRef: RefObject<LensPointer>;
  /** 正在播放的球（原曲或 #36）；有值时光圈锁在它身上。 */
  lockedId: string | null;
  selectionRef: MutableRefObject<LensSelection>;
  panelHotRef: MutableRefObject<boolean>;
  onPanelId: (id: string | null) => void;
  numberOf: (id: string | null) => string;
};

const HOVER_GRACE_MS = 200;

/** 读取首页命中层所有可交互球的屏幕圆（用的是球按钮真实矩形，与肉眼所见、点击命中一致）。 */
function readCircles(): Circle[] {
  const root = document.querySelector('.pond-home-surface');
  const out: Circle[] = [];
  root?.querySelectorAll<HTMLButtonElement>('button[data-render-node-id]').forEach((el) => {
    if (el.style.pointerEvents === 'none') return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4) return;
    out.push({ id: el.dataset.renderNodeId!, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
      r: rect.width / 2, echo: el.hasAttribute('data-echo-id') });
  });
  return out;
}

/** 光圈缓动 + 选球 + 面板定位，全部在一条 rAF 里；只有「面板对应哪个球」变化时才通知 React。 */
export function useLensFrame(args: Args) {
  const latest = useRef(args);
  useEffect(() => { latest.current = args; });
  const active = args.active;
  useEffect(() => {
    if (!active) return;
    let frame = 0, last = performance.now(), flipTimer = 0;
    const ring = { x: innerWidth / 2, y: innerHeight / 2, r: 120, seeded: false };
    let lastHover: { id: string; at: number } | null = null;
    let panelId: string | null = null;
    let anchor: Circle | null = null;
    let side: Side | undefined;
    const loop = (now: number) => {
      const s = latest.current;
      const dt = now - last; last = now;
      const circles = readCircles();
      const p = s.pointerRef.current;
      const base = innerWidth < 768 ? 90 : 120;
      const hover = p.has && p.mouse ? pickCircle(circles, p.x, p.y) : null;
      if (hover) lastHover = { id: hover.id, at: now };
      const pinnedId = s.lockedId ?? s.selectionRef.current?.id ?? null;
      const pinned = pinnedId ? circles.find((c) => c.id === pinnedId) ?? null : null;
      const graceful = !hover && lastHover && (s.panelHotRef.current || now - lastHover.at < HOVER_GRACE_MS);
      const hoverId = hover?.id ?? (graceful ? lastHover!.id : null);

      // 光圈目标：锁定 / 选中 → 球心；否则跟指针；还没有指针 → 画面中心。
      const tx = pinned ? pinned.x : p.has ? p.x : innerWidth / 2;
      const ty = pinned ? pinned.y : p.has ? p.y : innerHeight / 2;
      const tr = pinned ? Math.max(base, pinned.r * 1.8) : base;
      if (!ring.seeded && (p.has || pinned)) { ring.x = tx; ring.y = ty; ring.r = tr; ring.seeded = true; }
      const tau = s.reduced ? 0 : 85;
      ring.x = easeToward(ring.x, tx, dt, tau); ring.y = easeToward(ring.y, ty, dt, tau);
      ring.r = easeToward(ring.r, tr, dt, s.reduced ? 0 : 150);
      const veil = s.veilRef.current;
      if (veil) {
        veil.style.setProperty('--lx', `${ring.x.toFixed(1)}px`);
        veil.style.setProperty('--ly', `${ring.y.toFixed(1)}px`);
        veil.style.setProperty('--lr', `${ring.r.toFixed(1)}px`);
        const found = pinnedId ?? hoverId;
        const number = s.numberOf(found);
        if (veil.dataset.lensTarget !== number) veil.dataset.lensTarget = number;
        const locked = String(s.lockedId != null);
        if (veil.dataset.lensLocked !== locked) veil.dataset.lensLocked = locked;
      }

      // 面板对应的球：锁定 > 选中 > 悬停（含宽限）；#36 不出面板。
      const wanted = pinnedId ?? hoverId;
      const circle = wanted ? circles.find((c) => c.id === wanted) ?? null : null;
      const nextPanel = wanted && (circle ? !circle.echo : s.panelHotRef.current && wanted === panelId) ? wanted : null;
      if (nextPanel !== panelId) { panelId = nextPanel; anchor = null; side = undefined; s.onPanelId(nextPanel); }
      if (circle) anchor = circle;
      const panel = s.panelRef.current;
      if (panel && anchor && panelId) {
        const placed = placePanel(anchor, { w: panel.offsetWidth, h: panel.scrollHeight + 2 },
          { w: innerWidth, h: innerHeight, topInset: innerWidth < 768 ? 64 : 76 }, side);
        if (side && placed.side !== side && !s.reduced) {
          panel.dataset.flip = 'true';
          window.clearTimeout(flipTimer);
          flipTimer = window.setTimeout(() => { delete panel.dataset.flip; }, 140);
        }
        side = placed.side;
        panel.style.maxHeight = placed.maxH ? `${Math.floor(placed.maxH)}px` : '';
        panel.style.transform = `translate3d(${placed.left.toFixed(1)}px, ${placed.top.toFixed(1)}px, 0)`;
        panel.dataset.placed = 'true';
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(flipTimer); };
  }, [active]);
}
