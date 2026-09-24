'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { flushSync } from 'react-dom';
import { initialRouteTransaction, routeTransactionReducer } from './transition/route-reducer';
import {
  pathWithoutHash, routeForPath, type PondRoute, type PondRouteEvent, type PondRouteTransaction,
} from './transition/types';

export type PondTransitionPhase = 'home' | 'leaving-home' | 'archive' | 'entering-home' | 'score';
type ViewTransition = { finished: Promise<void>; skipTransition: () => void };
type TransitionDocument = Document & { startViewTransition?: (update: () => void) => ViewTransition };

type TransitionValue = {
  transaction: PondRouteTransaction;
  phase: PondTransitionPhase;
  destination: string | null;
  duration: number;
  archiveReady: boolean;
  navigate: (href: string) => number;
  prefetch: (href: string) => void;
  cancel: (generation?: number) => void;
  reportVisualReady: (owner: PondRoute, generation?: number) => void;
  reveal: (generation?: number) => void;
  settle: (generation?: number) => void;
  setArchiveReady: (ready: boolean) => void;
  runViewTransition: (update: () => void) => Promise<void>;
  waitForVisualReady: (generation?: number, ready?: () => boolean,
    failed?: () => boolean) => Promise<boolean>;
};

const PondTransitionContext = createContext<TransitionValue | null>(null);

function legacyPhase(tx: PondRouteTransaction, archiveReady: boolean): PondTransitionPhase {
  if (tx.stage === 'stable') return tx.current;
  if (tx.stage === 'preparing') return tx.current;
  if (tx.target === 'home') return 'entering-home';
  if (tx.current === 'home' && tx.target === 'archive' && !archiveReady) return 'home';
  if (tx.current === 'home' && tx.target === 'archive') return 'leaving-home';
  return tx.target;
}

function focusEntry() {
  const active = document.activeElement;
  if (active && active !== document.body && !active.closest('[inert]')) return;
  [...document.querySelectorAll<HTMLElement>('[data-pond-focus-entry]')]
    .find((node) => !node.closest('[inert]') && node.getClientRects().length > 0)
    ?.focus({ preventScroll: true });
}

/** 导航、视觉就绪、揭幕和收场由同一 generation 事务协调。 */
export function PondTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [transaction, setTransaction] = useState(() => initialRouteTransaction(pathname));
  const transactionRef = useRef(transaction);
  const [duration, setDuration] = useState(520);
  const [archiveReady, setArchiveReadyState] = useState(false);
  const activeViewTransition = useRef<ViewTransition | null>(null);
  const settleTimer = useRef<number | null>(null);
  const cancelledNavigation = useRef<{ href: string; restore: string; seen: boolean } | null>(null);

  const apply = useCallback((event: PondRouteEvent, sync = false) => {
    const next = routeTransactionReducer(transactionRef.current, event);
    if (next === transactionRef.current) return next;
    transactionRef.current = next;
    if (sync) flushSync(() => setTransaction(next));
    else setTransaction(next);
    return next;
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setDuration(reduced.matches ? 140 : fine.matches ? 520 : 320);
    queueMicrotask(sync);
    reduced.addEventListener('change', sync); fine.addEventListener('change', sync);
    return () => { reduced.removeEventListener('change', sync); fine.removeEventListener('change', sync); };
  }, []);

  const runViewTransition = useCallback(async (update: () => void) => {
    const previous = activeViewTransition.current;
    try { previous?.skipTransition(); } catch { /* previous already settled */ }
    const start = (document as TransitionDocument).startViewTransition;
    if (!start) { flushSync(update); return; }
    try {
      const active = start.call(document, () => flushSync(update));
      activeViewTransition.current = active;
      await active.finished.catch(() => undefined);
      if (activeViewTransition.current === active) activeViewTransition.current = null;
    } catch { flushSync(update); }
  }, []);

  const reveal = useCallback((generation = transactionRef.current.generation) => {
    const current = transactionRef.current;
    if (current.generation !== generation || !current.targetVisualReady) return;
    void runViewTransition(() => { apply({ type: 'reveal', generation, at: performance.now() }); });
  }, [apply, runViewTransition]);

  const reportVisualReady = useCallback((owner: PondRoute, generation = transactionRef.current.generation) => {
    const next = apply({ type: 'ready', generation, owner, at: performance.now() });
    if (next.generation === generation && next.targetVisualReady && next.stage === 'preparing') {
      queueMicrotask(() => reveal(generation));
    }
  }, [apply, reveal]);

  const settle = useCallback((generation = transactionRef.current.generation) => {
    const current = transactionRef.current;
    if (current.generation !== generation || pathWithoutHash(current.href) !== pathname) return;
    if (current.stage === 'preparing' && !current.targetVisualReady) return;
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    apply({ type: 'settle', generation, pathname, at: performance.now() }, true);
    focusEntry();
  }, [apply, pathname]);

  const navigate = useCallback((href: string) => {
    cancelledNavigation.current = null;
    const path = pathWithoutHash(href);
    if (path === window.location.pathname && transactionRef.current.stage === 'stable') {
      router.push(href); return transactionRef.current.generation;
    }
    const next = apply({ type: 'start', target: routeForPath(path), href: path, at: performance.now() }, true);
    router.prefetch(path); router.push(href);
    if (next.target === 'home') reportVisualReady('home', next.generation);
    return next.generation;
  }, [apply, reportVisualReady, router]);

  const cancel = useCallback((generation = transactionRef.current.generation) => {
    const current = transactionRef.current;
    if (current.generation !== generation) return;
    try { activeViewTransition.current?.skipTransition(); } catch { /* already settled */ }
    apply({ type: 'cancel', generation, at: performance.now() }, true);
    cancelledNavigation.current = { href: current.href, restore: current.currentHref, seen: false };
    router.replace(current.currentHref);
  }, [apply, router]);

  const waitForVisualReady = useCallback(async (generation: number | undefined,
    ready: () => boolean = () => false, failed: () => boolean = () => false) => {
    const expected = generation ?? transactionRef.current.generation;
    const deadline = performance.now() + 30_000;
    while (performance.now() < deadline) {
      const current = transactionRef.current;
      if (current.generation !== expected || failed()) return false;
      if (current.targetVisualReady || ready()) return true;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return false;
  }, []);

  const setArchiveReady = useCallback((ready: boolean) => {
    setArchiveReadyState(ready);
  }, []);

  useEffect(() => {
    const tx = transactionRef.current;
    const landed = routeForPath(pathname);
    const cancelled = cancelledNavigation.current;
    if (cancelled && pathname === cancelled.href) {
      cancelled.seen = true; router.replace(cancelled.restore); return;
    }
    if (cancelled?.seen && pathname === cancelled.restore) cancelledNavigation.current = null;
    if (tx.stage === 'stable' && landed !== tx.current) {
      const next = apply({ type: 'start', target: landed, href: pathname, at: performance.now() });
      if (landed === 'home') reportVisualReady('home', next.generation);
      return;
    }
    if (tx.stage !== 'stable' && pathname !== tx.href) {
      if (pathname !== tx.currentHref) router.replace(tx.href);
      return;
    }
    if (tx.target !== landed || tx.stage === 'preparing') return;
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => settle(tx.generation), duration + 120);
  }, [apply, duration, pathname, reportVisualReady, router, settle, transaction.stage]);

  useEffect(() => {
    const onPopState = () => {
      cancelledNavigation.current = null;
      const path = window.location.pathname;
      const next = apply({ type: 'start', target: routeForPath(path), href: path, at: performance.now() }, true);
      if (next.target === 'home') reportVisualReady('home', next.generation);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const tx = transactionRef.current;
      if (event.key !== 'Escape' || tx.stage !== 'preparing') return;
      cancel(tx.generation);
      if (routeForPath(window.location.pathname) === tx.target) window.history.back();
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [apply, cancel, reportVisualReady]);

  useEffect(() => {
    if (transaction.stage !== 'revealing') return;
    apply({ type: 'settling', generation: transaction.generation });
  }, [apply, transaction.generation, transaction.stage]);

  useEffect(() => () => {
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    try { activeViewTransition.current?.skipTransition(); } catch { /* already settled */ }
  }, []);

  const phase = legacyPhase(transaction, archiveReady);
  const value = useMemo<TransitionValue>(() => ({
    transaction, phase, destination: transaction.stage === 'stable' ? null : transaction.href,
    duration, archiveReady, navigate, prefetch: (href) => router.prefetch(pathWithoutHash(href)),
    cancel, reportVisualReady, reveal, settle, setArchiveReady, runViewTransition, waitForVisualReady,
  }), [archiveReady, cancel, duration, navigate, phase, reportVisualReady, reveal, router,
    runViewTransition, setArchiveReady, settle, transaction, waitForVisualReady]);
  return <PondTransitionContext.Provider value={value}>{children}</PondTransitionContext.Provider>;
}

export function usePondTransition() { return useContext(PondTransitionContext); }
