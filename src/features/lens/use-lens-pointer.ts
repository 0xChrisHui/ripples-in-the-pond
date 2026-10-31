'use client';
import { useEffect, useRef } from 'react';

export type LensPointer = { x: number; y: number; has: boolean; mouse: boolean };

/** 窗口级指针位置（不触发渲染）；真实鼠标移动时通知，用于撤销深链预选。 */
export function useLensPointer(active: boolean, onMouseMove: () => void) {
  const pointer = useRef<LensPointer>({ x: 0, y: 0, has: false, mouse: false });
  const notify = useRef(onMouseMove);
  useEffect(() => { notify.current = onMouseMove; });
  useEffect(() => {
    if (!active) return;
    const track = (event: PointerEvent) => {
      const mouse = event.pointerType === 'mouse';
      const moved = mouse && pointer.current.has && (event.clientX !== pointer.current.x || event.clientY !== pointer.current.y);
      pointer.current = { x: event.clientX, y: event.clientY, has: true, mouse };
      if (moved) notify.current();
    };
    const leave = () => { pointer.current.has = false; };
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
