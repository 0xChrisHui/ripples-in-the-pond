'use client';
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { easeToward, placePanel, placeDrawer, ringAim, type Circle, type Side } from './lens-geometry';
import { HOVER_IDLE, stepHover, type HoverState } from './hover/lens-hover';
import type { LensPointer } from './use-lens-pointer';
import { mintPinnedTrackId } from '@/src/components/music-catalog/claim/mint-status-cache';

export type LensSelection = { id: string; source: 'tap' | 'deeplink' | 'key' } | null;
/** id 在关闭后仍保留，让面板淡出时内容不消失。 */
export type PanelState = { id: string | null; open: boolean };

type Args = {
  active: boolean;
  reduced: boolean;
  veilRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  pointerRef: RefObject<LensPointer>;
  /** 正在播放的球（原曲或 #36）；有值时光圈锁在它身上。 */
  lockedId: string | null;
  selectionRef: MutableRefObject<LensSelection>;
  onPanel: (state: PanelState) => void;
  numberOf: (id: string | null) => string;
};

const PANEL_TAU_MS = 70;

/** 底部播放器的顶边：面板不得压到它下面。播放器是固定定位，高度随视口与安全区变化，所以每次实测。 */
function playerTop(): number {
  const top = document.querySelector('.bottom-player-shell')?.getBoundingClientRect().top;
  return top && top > 0 ? top - 8 : innerHeight;
}

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

function pointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** 光圈缓动 + 悬停选球 + 面板定位，全部在一条 rAF 里；只有「面板对应哪个球、开或合」变化时才通知 React。 */
export function useLensFrame(args: Args) {
  const latest = useRef(args);
  useEffect(() => { latest.current = args; });
  const active = args.active;
  useEffect(() => {
    if (!active) return;
    let frame = 0, last = performance.now();
    const ring = { x: innerWidth / 2, y: innerHeight / 2, r: 120, seeded: false };
    const panelPos = { x: 0, y: 0, seeded: false };
    let hover: HoverState = HOVER_IDLE;
    let reported: PanelState = { id: null, open: false };
    let anchor: Circle | null = null;
    let side: Side | undefined;
    const loop = (now: number) => {
      const s = latest.current;
      const dt = now - last; last = now;
      const circles = readCircles();
      const p = s.pointerRef.current;
      const base = innerWidth < 768 ? 90 : 120;
      const panel = s.panelRef.current;
      // 悬停只认窗口内的鼠标；光圈瞄准则用最后位置（离开窗口后停在边缘）。
      const mouse = p.inside && p.mouse ? { x: p.x, y: p.y } : null;
      const inPanel = reported.open && !!panel
        && ((mouse != null && pointInRect(mouse.x, mouse.y, panel.getBoundingClientRect()))
          || panel.contains(document.activeElement));
      // 有鼠标但离开了页面（如去操作钱包弹窗）：悬停保持，不当作“鼠标离开了球”
      hover = stepHover(hover, { now, pointer: mouse, circles, inPanel, away: p.mouse && !p.inside });

      const pinnedId = s.lockedId ?? s.selectionRef.current?.id ?? null;
      // 铸造进行中（等钱包 / 待确认）的曲目：悬停落空时面板仍停在它身上，直到结果出来再保留几秒。
      const wanted = pinnedId ?? hover.shown ?? mintPinnedTrackId();
      const found = wanted ? circles.find((c) => c.id === wanted) ?? null : null;
      const pinned = pinnedId ? circles.find((c) => c.id === pinnedId) ?? null : null;

      // 光圈目标：锁定 / 选中 → 球心；否则停在最后指针位置（夹到视口内）；从未有过指针 → 画面中心。
      const aim = ringAim(p, pinned, innerWidth, innerHeight);
      const tx = aim.x, ty = aim.y;
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
        const number = s.numberOf(wanted);
        if (veil.dataset.lensTarget !== number) veil.dataset.lensTarget = number;
        const locked = String(s.lockedId != null);
        if (veil.dataset.lensLocked !== locked) veil.dataset.lensLocked = locked;
      }

      // 面板：目标球存在且非 #36 时打开；球暂时不在画面内则保留上一个锚点，不乱跳。
      const open = !!found && !found.echo;
      if (found && !found.echo) anchor = found;
      const id = open ? wanted : reported.id;
      if (id !== reported.id || open !== reported.open) {
        reported = { id, open };
        s.onPanel(reported);
      }
      if (panel && open && anchor) {
        const mobile = innerWidth < 768;
        const placed = mobile ? placeDrawer(anchor, panel.scrollHeight + 2, { w: innerWidth, h: playerTop(), topInset: 64 })
          : placePanel(anchor, { w: panel.offsetWidth, h: panel.scrollHeight + 2 }, { w: innerWidth, h: playerTop(), topInset: 76 }, side);
        if (!mobile) side = placed.side as Side;
        panel.dataset.dock = placed.side;
        // 订单内容会动态增长；保留同一收藏实例，用内部滚动提供完整入口。
        panel.style.maxHeight = `${placed.maxH ?? Math.max(160, playerTop() - 100)}px`;
        if (!panelPos.seeded || s.reduced || mobile) {
          panelPos.x = placed.left; panelPos.y = placed.top; panelPos.seeded = true;
        } else {
          panelPos.x = easeToward(panelPos.x, placed.left, dt, PANEL_TAU_MS);
          panelPos.y = easeToward(panelPos.y, placed.top, dt, PANEL_TAU_MS);
        }
        panel.style.transform = `translate3d(${panelPos.x.toFixed(1)}px, ${panelPos.y.toFixed(1)}px, 0)`;
        if (panel.dataset.placed !== 'true') panel.dataset.placed = 'true'; // 首次落位后才允许可见，避免在 (0,0) 闪现
      } else {
        panelPos.seeded = false; // 下次打开直接落位，不从旧位置滑过来
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active]);
}
