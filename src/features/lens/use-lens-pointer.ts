'use client';
import { useEffect, useRef } from 'react';

/**
 * has：曾收到过指针坐标（光圈据此停在最后位置）；
 * mouse：最近一次是鼠标（悬停判断只看鼠标）；
 * inside：鼠标当前在窗口内（离开窗口后为 false，悬停立即失效，但坐标保留）。
 */
export type LensPointer = { x: number; y: number; has: boolean; mouse: boolean; inside: boolean };

/** 窗口级指针位置（不触发渲染）；真实鼠标移动时通知，用于撤销深链预选。 */
export function useLensPointer(active: boolean, onMouseMove: () => void) {
  const pointer = useRef<LensPointer>({ x: 0, y: 0, has: false, mouse: false, inside: false });
  const notify = useRef(onMouseMove);
  useEffect(() => { notify.current = onMouseMove; });
  useEffect(() => {
    if (!active) return;
    const track = (event: PointerEvent) => {
      const mouse = event.pointerType === 'mouse';
      const prev = pointer.current;
      const moved = mouse && prev.has && (event.clientX !== prev.x || event.clientY !== prev.y);
      pointer.current = { x: event.clientX, y: event.clientY, has: true, mouse, inside: mouse };
      if (moved) notify.current();
    };
    // 离开窗口：只取消悬停，不清坐标，光圈停在最后位置。
    const leave = () => { pointer.current = { ...pointer.current, inside: false }; };
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerdown', track, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerdown', track);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, [active]);
  return pointer;
}
