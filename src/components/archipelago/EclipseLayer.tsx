'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  zoomGRef: React.RefObject<SVGGElement | null>;
  eclipseGRef: React.RefObject<SVGGElement | null>;
}

/** server 时返回 false，client mount 后返回 true 并触发 re-render（用于 Portal mount）*/
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Phase 6 B2 — 日食覆盖层（v21 修 SSR Portal）
 *
 * 之前用 `typeof window === 'undefined'` 早 return null，prod SSR hydrate 后
 * React 锁定该 null 不再重 render，Portal 永不挂载（首次进入 / 看到的是球变白
 * 而非日食；进 /me 再回来 client-side 重新 mount 才正常）。
 *
 * 改用 useSyncExternalStore 双快照 API：server snapshot=false / client=true，
 * React 自动在 hydration 后切换并 re-render，Portal 挂到 document.body。
 */
export default function EclipseLayer({ zoomGRef, eclipseGRef }: Props) {
  const isClient = useIsClient();
  if (!isClient) return null;

  return createPortal(
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="eclipse-halo">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="22%" stopColor="white" stopOpacity="0" />
          <stop offset="24%" stopColor="white" stopOpacity="0.55" />
          <stop offset="36%" stopColor="white" stopOpacity="0.32" />
          <stop offset="60%" stopColor="white" stopOpacity="0.10" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={zoomGRef}>
        <g ref={eclipseGRef} style={{ display: 'none' }}>
          <circle r="220" fill="url(#eclipse-halo)" />
          <circle r="50" fill="black" />
          <circle r="51" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.92" />
          <rect x="-14" y="-22" width="9" height="44" fill="white" opacity="0.1" />
          <rect x="5" y="-22" width="9" height="44" fill="white" opacity="0.1" />
        </g>
      </g>
    </svg>,
    document.body,
  );
}
