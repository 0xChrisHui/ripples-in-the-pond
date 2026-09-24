'use client';

import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';

export type ScoreOrigin = {
  id: number;
  key: string;
  href: string;
  tokenId: number;
  trackTitle: string;
  ownerKey: string;
  section: string;
  page: number;
  scrollY: number;
  rect: { x: number; y: number; width: number; height: number };
  stage: 'forward' | 'score' | 'returning';
};

type Value = {
  origin: ScoreOrigin | null;
  capture: (origin: Omit<ScoreOrigin, 'id' | 'stage'>) => number;
  confirmScore: (tokenId: number, href: string) => boolean;
  beginReturn: (id?: number, sync?: boolean) => number | null;
  clear: (id?: number) => boolean;
};

const ScoreOriginContext = createContext<Value | null>(null);

/** 仅保存唱片来源、分页、滚动与锚点阶段；不拥有导航或动画时序。 */
export function ScoreOriginProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<ScoreOrigin | null>(null);
  const originRef = useRef<ScoreOrigin | null>(null);
  const nextId = useRef(0);
  const write = useCallback((value: ScoreOrigin | null) => {
    originRef.current = value;
    setOrigin(value);
  }, []);
  const capture = useCallback((next: Omit<ScoreOrigin, 'id' | 'stage'>) => {
    const value: ScoreOrigin = { ...next, id: ++nextId.current, stage: 'forward' };
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
  const value = useMemo<Value>(() => ({
    origin, capture, confirmScore, beginReturn, clear,
  }), [beginReturn, capture, clear, confirmScore, origin]);
  return <ScoreOriginContext.Provider value={value}>{children}</ScoreOriginContext.Provider>;
}

export function useScoreOrigin() {
  const context = useContext(ScoreOriginContext);
  if (!context) throw new Error('Score 来源必须位于 PersistentPondShell 内');
  return context;
}

export function useOptionalScoreOrigin() { return useContext(ScoreOriginContext); }
export function viewTransitionName() { return 'score-record'; }
