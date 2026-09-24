'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';

export type ScoreOrigin = {
  id: number;
  key: string;
  href: string;
  tokenId: number;
  ownerKey: string;
  section: string;
  page: number;
  scrollY: number;
  rect: { x: number; y: number; width: number; height: number };
  stage: 'forward' | 'score' | 'returning';
};

type Transition = { finished: Promise<void>; skipTransition: () => void };
type TransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => Transition;
};
type Value = {
  origin: ScoreOrigin | null;
  capture: (origin: Omit<ScoreOrigin, 'id' | 'stage'>) => number;
  confirmScore: (tokenId: number, href: string) => boolean;
  beginReturn: (id?: number, sync?: boolean) => number | null;
  clear: (id?: number) => boolean;
  run: (update: () => void, ready: () => boolean, id: number,
    failed?: () => boolean) => Promise<boolean>;
};

const ScoreOriginContext = createContext<Value | null>(null);

async function waitUntil(ready: () => boolean, cancelled: () => boolean, timeout = 30_000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (cancelled()) return false;
    if (ready()) return true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return ready();
}

export function ScoreOriginProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<ScoreOrigin | null>(null);
  const originRef = useRef<ScoreOrigin | null>(null);
  const nextId = useRef(0);
  const active = useRef<Transition | null>(null);
  const write = useCallback((value: ScoreOrigin | null) => {
    originRef.current = value;
    setOrigin(value);
  }, []);
  const capture = useCallback((next: Omit<ScoreOrigin, 'id' | 'stage'>) => {
    const value: ScoreOrigin = { ...next, id: ++nextId.current, stage: 'forward' };
    try { active.current?.skipTransition(); } catch { active.current = null; }
    flushSync(() => write(value));
    return value.id;
  }, [write]);
  const clear = useCallback((id?: number) => {
    if (id != null && originRef.current?.id !== id) return false;
    write(null);
    return true;
  }, [write]);
  const confirmScore = useCallback((tokenId: number, href: string) => {
    const current = originRef.current;
    if (!current || current.tokenId !== tokenId || current.href !== href) {
      if (current) clear(current.id);
      return false;
    }
    if (current.stage === 'forward') write({ ...current, stage: 'score' });
    return true;
  }, [clear, write]);
  const beginReturn = useCallback((id?: number, sync = true) => {
    const current = originRef.current;
    if (!current || (id != null && current.id !== id)) return null;
    const next = { ...current, stage: 'returning' as const };
    if (sync) flushSync(() => write(next));
    else write(next);
    return current.id;
  }, [write]);
  const run = useCallback(async (update: () => void, ready: () => boolean, id: number,
    failed: () => boolean = () => false) => {
    const previous = active.current;
    if (previous) {
      try { previous.skipTransition(); } catch { /* 已结束的转场无需再取消。 */ }
      if (active.current === previous) active.current = null;
    }
    let landed = false;
    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      update();
      landed = await waitUntil(ready, () => originRef.current?.id !== id || failed());
    };
    const doc = document as TransitionDocument;
    if (!doc.startViewTransition) {
      await commit();
      return landed;
    }
    let transition: Transition;
    try {
      transition = doc.startViewTransition(commit);
    } catch {
      await commit();
      return landed;
    }
    active.current = transition;
    const kick = window.setTimeout(() => { void commit(); }, 100);
    const cancelled = new Promise<void>((resolve) => {
      const check = () => {
        if (landed) return;
        if (originRef.current?.id !== id) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
    await Promise.race([
      transition.finished.catch(() => undefined),
      cancelled,
      new Promise<void>((resolve) => window.setTimeout(resolve, 31_000)),
    ]);
    window.clearTimeout(kick);
    if (active.current === transition) {
      try { transition.skipTransition(); } catch { /* 已自然结束。 */ }
      active.current = null;
    }
    return landed;
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const current = originRef.current;
      if (!current || current.stage !== 'score' || window.location.pathname !== '/me') return;
      const id = beginReturn();
      if (id == null) return;
      void run(() => undefined, () => Boolean(document.querySelector(
        `.pond-prepared-archive[data-interactive="true"] [data-score-origin-key="${CSS.escape(current.key)}"]`,
      )), id);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const current = originRef.current;
      if (event.key !== 'Escape' || current?.stage !== 'forward') return;
      try { active.current?.skipTransition(); } catch { active.current = null; }
      clear(current.id);
      if (window.location.pathname !== '/me') window.history.back();
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [beginReturn, clear, run]);

  const value = useMemo<Value>(() => ({
    origin, capture, confirmScore, beginReturn, clear, run,
  }), [beginReturn, capture, clear, confirmScore, origin, run]);
  return <ScoreOriginContext.Provider value={value}>{children}</ScoreOriginContext.Provider>;
}

export function useScoreOrigin() {
  const context = useContext(ScoreOriginContext);
  if (!context) throw new Error('Score 来源必须位于 PersistentPondShell 内');
  return context;
}

export function useOptionalScoreOrigin() {
  return useContext(ScoreOriginContext);
}

export function viewTransitionName() {
  return 'score-record';
}
