'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { flushSync } from 'react-dom';

export type PondTransitionPhase = 'home' | 'leaving-home' | 'archive' | 'entering-home' | 'score';

type TransitionValue = {
  phase: PondTransitionPhase;
  destination: string | null;
  duration: number;
  archiveReady: boolean;
  navigate: (href: string) => void;
  prefetch: (href: string) => void;
  settle: () => void;
  setArchiveReady: (ready: boolean) => void;
};

const PondTransitionContext = createContext<TransitionValue | null>(null);

function stablePhase(pathname: string): PondTransitionPhase {
  if (pathname === '/') return 'home';
  return pathname.startsWith('/score/') ? 'score' : 'archive';
}

function focusEntry() {
  // 离场层变 inert 后浏览器会把焦点丢回 body；只在这种情况下把焦点交给目标页入口。
  const active = document.activeElement;
  if (active && active !== document.body && !active.closest('[inert]')) return;
  const entry = [...document.querySelectorAll<HTMLElement>('[data-pond-focus-entry]')]
    .find((node) => !node.closest('[inert]') && node.getClientRects().length > 0);
  entry?.focus({ preventScroll: true });
}

/** 导航意图、地址落地与动画结束分开记录；只有目标地址落地后才允许收场。 */
export function PondTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<PondTransitionPhase>(() => stablePhase(pathname));
  const [destination, setDestination] = useState<string | null>(null);
  const [duration, setDuration] = useState(520);
  const [archiveReady, setArchiveReady] = useState(false);
  const intentRef = useRef<string | null>(null);
  const originRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setDuration(reduced.matches ? 140 : fine.matches ? 520 : 320);
    queueMicrotask(sync);
    reduced.addEventListener('change', sync);
    fine.addEventListener('change', sync);
    return () => {
      reduced.removeEventListener('change', sync);
      fine.removeEventListener('change', sync);
    };
  }, []);

  const settle = useCallback(() => {
    // 旧地址上的兜底计时器与过渡事件不能结束尚未落地的新导航。
    if (intentRef.current && pathname !== intentRef.current) return;
    if (pathname === '/me' && !archiveReady) return;
    const moving = intentRef.current !== null || phase === 'leaving-home' || phase === 'entering-home';
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    intentRef.current = null;
    originRef.current = null;
    flushSync(() => { setDestination(null); setPhase(stablePhase(pathname)); });
    if (moving) focusEntry();
  }, [archiveReady, pathname, phase]);

  const armFallback = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(settle, duration + 120);
  }, [duration, settle]);

  const navigate = useCallback((href: string) => {
    const targetPath = href.split('#')[0] || '/';
    const current = window.location.pathname;
    if (targetPath === current && !intentRef.current) {
      router.push(href);
      return;
    }
    originRef.current = current;
    intentRef.current = targetPath;
    flushSync(() => {
      setDestination(targetPath);
      setPhase(targetPath === '/me' && !archiveReady ? stablePhase(current)
        : targetPath === '/' ? 'entering-home'
          : current === '/' ? 'leaving-home' : stablePhase(targetPath));
    });
    router.prefetch(targetPath);
    if (targetPath !== '/me' || archiveReady) armFallback();
    router.push(href);
  }, [archiveReady, armFallback, router]);

  useEffect(() => {
    const intended = intentRef.current;
    if (intended && pathname !== intended) {
      // 快速反向时较早的 push 可能后落地；最后一次导航意图获胜。
      if (pathname !== originRef.current && (intended === '/' || intended.startsWith('/me')
        || intended.startsWith('/score/'))) {
        router.replace(intended);
      }
      return;
    }
    if (phase === 'home' || phase === 'archive' || phase === 'score') {
      const next = stablePhase(pathname);
      if (pathname === '/me' && !archiveReady) return;
      if (next !== phase) queueMicrotask(() => setPhase(
        next === 'home' ? 'entering-home' : phase === 'home' ? 'leaving-home' : next,
      ));
    }
    armFallback();
  }, [archiveReady, armFallback, pathname, phase, router]);

  useEffect(() => {
    const landed = phase === 'leaving-home' ? pathname === '/me' && archiveReady
      : phase === 'entering-home' ? pathname === '/' : false;
    if (!landed) return;
    const timer = window.setTimeout(settle, duration + 120);
    return () => window.clearTimeout(timer);
  }, [archiveReady, duration, pathname, phase, settle]);

  useEffect(() => {
    if (intentRef.current !== pathname || phase !== stablePhase(pathname)) return;
    if (pathname === '/me' && !archiveReady) return;
    queueMicrotask(settle);
  }, [archiveReady, pathname, phase, settle]);

  useEffect(() => {
    const onPopState = () => {
      // 历史导航取消旧点击意图，避免冷加载期间返回时卡在旧目标。
      intentRef.current = null;
      originRef.current = null;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      setDestination(null);
      const target = window.location.pathname;
      // 地址监听可能已先把相位推到 leaving-home；这里不能再跳到终态，否则既无淡入也不收场。
      setPhase((current) => target === '/'
        ? current === 'home' ? 'home' : 'entering-home'
        : target === '/me' && (current === 'home' || current === 'entering-home' || current === 'leaving-home')
          ? archiveReady ? 'leaving-home' : 'home' : stablePhase(target));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [archiveReady]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) settle(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [settle]);

  const value = useMemo<TransitionValue>(() => ({
    phase, destination, duration, archiveReady, navigate,
    prefetch: (href) => router.prefetch(href.split('#')[0] || '/'), settle, setArchiveReady,
  }), [archiveReady, destination, duration, navigate, phase, router, settle]);
  return <PondTransitionContext.Provider value={value}>{children}</PondTransitionContext.Provider>;
}

export function usePondTransition() {
  return useContext(PondTransitionContext);
}
