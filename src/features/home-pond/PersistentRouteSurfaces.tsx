'use client';

import dynamic from 'next/dynamic';
import {
  Suspense, useCallback, useEffect, useRef, type ReactNode, type TransitionEvent,
} from 'react';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';
import { useOptionalScoreOrigin } from '@/src/components/pond-shell/score/score-origin';
import type { PondRoute } from '@/src/components/pond-shell/transition/types';

const PreparedArchive = dynamic(() => import('@/app/(pond)/me/MePondArchive'), { ssr: false });

function visible(owner: PondRoute, current: PondRoute, target: PondRoute, stage: string) {
  return stage === 'stable' ? current === owner : stage === 'preparing' ? current === owner : target === owner;
}

type Props = {
  persistent: boolean;
  pathname: string;
  prepareArchive: boolean;
  homeClassName: string;
  homeRoot: boolean;
  glHealth: string;
  sceneReady: boolean;
  home: ReactNode;
  children?: ReactNode;
};

/** 三个前景 Surface 只切显隐和交互权；Water Core 永远留在它们之外。 */
export default function PersistentRouteSurfaces({
  persistent, pathname, prepareArchive, homeClassName, homeRoot, glHealth, sceneReady, home, children,
}: Props) {
  const transition = usePondTransition();
  const scoreOrigin = useOptionalScoreOrigin();
  const tx = transition?.transaction;
  const current = tx?.current ?? (pathname === '/' ? 'home' : 'archive');
  const target = tx?.target ?? current;
  const stage = tx?.stage ?? 'stable';
  const interactive = tx?.interactiveOwner ?? current;
  const homeVisible = !persistent || visible('home', current, target, stage);
  const archiveVisible = persistent && visible('archive', current, target, stage);
  const scoreVisible = persistent && visible('score', current, target, stage);
  const routeRef = useRef<HTMLDivElement>(null);

  const settleOnReveal = useCallback((event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (getComputedStyle(event.currentTarget).opacity === '1') transition?.settle();
  }, [transition]);

  const archivePrepared = useCallback((ready: boolean) => {
    transition?.setArchiveReady(ready);
    if (ready && scoreOrigin?.origin?.stage !== 'returning') {
      transition?.reportVisualReady('archive');
    }
  }, [scoreOrigin?.origin?.stage, transition]);

  useEffect(() => {
    if (!transition?.archiveReady || target !== 'archive' || stage !== 'preparing'
      || scoreOrigin?.origin?.stage === 'returning') return;
    transition.reportVisualReady('archive', tx?.generation);
  }, [scoreOrigin?.origin?.stage, stage, target, transition, tx?.generation]);

  useEffect(() => {
    if (!transition || target !== 'home' || stage !== 'preparing') return;
    const node = document.querySelector<HTMLElement>('.pond-home-surface');
    if (node?.getClientRects().length) transition.reportVisualReady('home', tx?.generation);
  }, [stage, target, transition, tx?.generation]);

  useEffect(() => {
    if (!transition || target !== 'score' || stage !== 'preparing') return;
    if (pathname !== tx?.href) return;
    const root = routeRef.current;
    const inspect = () => {
      const node = root?.querySelector<HTMLElement>('main[data-score-state], main.score-fallback');
      if (!node || node.getClientRects().length === 0) return;
      transition.reportVisualReady('score', tx?.generation);
    };
    inspect();
    const observer = new MutationObserver(inspect);
    if (root) observer.observe(root, { childList: true, subtree: true, attributes: true });
    return () => observer.disconnect();
  }, [pathname, stage, target, transition, tx?.generation, tx?.href]);

  return (
    <>
      <main className={homeClassName} data-active={homeVisible} data-interactive={interactive === 'home'}
        aria-hidden={!homeVisible} inert={persistent && interactive !== 'home'}
        onTransitionEnd={settleOnReveal} data-pond-root={homeRoot ? 'true' : undefined}
        data-pond-eclipse-active="false" data-gl-health={glHealth} data-scene-ready={sceneReady}>
        {home}
      </main>
      {prepareArchive && <div className="pond-prepared-archive" data-active={archiveVisible}
        data-interactive={interactive === 'archive'} data-prepared={transition?.archiveReady}
        aria-hidden={!archiveVisible} inert={interactive !== 'archive'} onTransitionEnd={settleOnReveal}>
        <PreparedArchive onPrepared={archivePrepared} />
      </div>}
      {persistent && <div ref={routeRef} className="pond-route-surface" data-active={scoreVisible}
        data-interactive={interactive === 'score'}
        data-archive-placeholder={stage === 'stable' && current !== 'score'}
        aria-hidden={!scoreVisible} inert={interactive !== 'score'} onTransitionEnd={settleOnReveal}>
        <Suspense fallback={null}>{children}</Suspense>
      </div>}
    </>
  );
}
