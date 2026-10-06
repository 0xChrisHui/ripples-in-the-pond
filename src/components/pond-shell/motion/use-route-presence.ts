'use client';
import { useLayoutEffect, useRef } from 'react';
import type { PondRouteTransaction } from '../transition/types';
import { getScenePresence, interpolatePresence, POND_ROUTES, setScenePresence } from './scene-presence';
import { releaseSurface } from './route-scroll';

/** 只更新少量样式与共享引用，不逐帧触发 React；旧前景淡完前保持可绘制。 */
export function useRoutePresence(transaction: PondRouteTransaction | undefined, duration: number, pathname: string) {
  const initialized = useRef(false);
  const owner = transaction?.interactiveOwner;
  const incomingReady = transaction?.targetVisualReady === true && transaction.stage !== 'preparing';
  useLayoutEffect(() => {
    if (!owner) return;
    if (!initialized.current) {
      POND_ROUTES.forEach(route => setScenePresence(route, route === owner ? 1 : 0));
      initialized.current = true;
    }
    const from = Object.fromEntries(POND_ROUTES.map(route => [route, getScenePresence(route)]));
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      POND_ROUTES.forEach(route => setScenePresence(route,
        interpolatePresence(from[route], route === owner ? 1 : 0, now - started, duration)));
      document.querySelectorAll<HTMLElement>('[data-pond-surface]').forEach(node => {
        const route = node.dataset.pondSurface as typeof owner;
        const value = getScenePresence(route);
        if (node.dataset.pondSnapshot && (value === 0 || route === owner && incomingReady)) { node.remove(); return; }
        if (node.dataset.pondSnapshotSource && (node.dataset.pondSnapshotSource !== route
          || !document.querySelector('[data-pond-snapshot]'))) delete node.dataset.pondSnapshotSource;
        if (!node.dataset.pondSnapshot && (route === owner || value === 0)) releaseSurface(node);
        node.style.opacity = node.dataset.pondSnapshotSource ? '0' : String(value);
        node.style.visibility = value > 0 || route === owner ? 'visible' : 'hidden';
      });
      if (now - started < duration) frame = requestAnimationFrame(tick);
    };
    tick(started);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, incomingReady, owner, pathname]);
}
