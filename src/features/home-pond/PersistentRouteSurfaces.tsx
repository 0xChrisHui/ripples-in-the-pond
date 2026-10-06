'use client';

import dynamic from 'next/dynamic';
import {
  Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TransitionEvent,
} from 'react';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';
import { useOptionalScoreOrigin } from '@/src/components/pond-shell/score/score-origin';
import type { PondRoute } from '@/src/components/pond-shell/transition/types';
import ArtistPondPage from '@/src/components/artist/ArtistPondPage';
import PondHeader from '@/src/components/pond-gl-test3/overlay/PondHeader';
import { useRoutePresence } from '@/src/components/pond-shell/motion/use-route-presence';

const PreparedArchive = dynamic(() => import('@/app/(pond)/me/MePondArchive'), { ssr: false });
const PreparedTracks = dynamic(() => import('./PreparedTracks'), { ssr: false });

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

/** 前景 Surface 只切显隐和交互权；Water Core 永远留在它们之外。 */
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
  useRoutePresence(persistent ? tx : undefined, transition?.duration ?? 520, pathname);
  const homeVisible = !persistent || visible('home', current, target, stage);
  const archiveVisible = persistent && visible('archive', current, target, stage);
  const scoreVisible = persistent && visible('score', current, target, stage);
  const tracksVisible = persistent && visible('tracks', current, target, stage);
  const artistVisible = persistent && visible('artist', current, target, stage);
  const [tracksPrepared, setTracksPrepared] = useState(current === 'tracks');
  const routeOwner = pathname.startsWith('/echo/') ? 'echo' : pathname.startsWith('/me/material') ? 'detail' : 'score';
  const routeInteractive = interactive === routeOwner;
  const pageVisible = scoreVisible || visible('echo', current, target, stage) || visible('detail', current, target, stage);
  const routeRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (target === 'tracks') queueMicrotask(() => setTracksPrepared(true));
  }, [target]);

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

  useLayoutEffect(() => {
    if (transition && stage === 'preparing' && !tx?.targetVisualReady && (target === 'artist' || target === 'tracks')) {
      const ready = target === 'artist' || !!tracksRef.current?.querySelector('[data-track-surface="pond"]');
      if (ready) transition.reportVisualReady(target, tx?.generation);
    }
  }, [stage, target, tracksPrepared, transition, tx?.generation, tx?.targetVisualReady]);

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
    if (!transition || !['score', 'tracks', 'echo', 'detail'].includes(target) || stage !== 'preparing' || tx?.targetVisualReady) return;
    if (pathname !== tx?.href) return;
    const root = target === 'tracks' ? tracksRef.current : routeRef.current;
    const inspect = () => {
      const selector = target === 'tracks' ? 'main[data-track-surface="pond"]'
        : target === 'score' || target === 'echo' ? `main[data-p11-theme="${target}"]` : 'main';
      const node = root?.querySelector<HTMLElement>(selector);
      if (!node || node.getClientRects().length === 0) return;
      transition.reportVisualReady(target, tx?.generation);
    };
    inspect();
    const observer = new MutationObserver(inspect);
    if (root) observer.observe(root, { childList: true, subtree: true, attributes: true });
    return () => observer.disconnect();
  }, [pathname, stage, target, transition, tx?.generation, tx?.href, tx?.targetVisualReady]);

  return (
    <>
      {persistent && <PondHeader />}
      <main className={homeClassName} data-pond-surface={persistent ? 'home' : undefined} data-active={homeVisible} data-interactive={interactive === 'home'}
        aria-hidden={!homeVisible} inert={persistent && interactive !== 'home'}
        onTransitionEnd={settleOnReveal} data-pond-root={homeRoot ? 'true' : undefined}
        data-pond-eclipse-active="false" data-gl-health={glHealth} data-scene-ready={sceneReady}>
        {home}
      </main>
      {prepareArchive && <div className="pond-prepared-archive" data-pond-surface="archive" data-active={archiveVisible}
        data-interactive={interactive === 'archive' && !pathname.startsWith('/me/material')} data-prepared={transition?.archiveReady}
        aria-hidden={!archiveVisible || pathname.startsWith('/me/material')}
        inert={interactive !== 'archive' || pathname.startsWith('/me/material')} onTransitionEnd={settleOnReveal}>
        <PreparedArchive onPrepared={archivePrepared} showControls={pathname === '/me/test'} />
      </div>}
      {persistent && tracksPrepared && <div ref={tracksRef} className="pond-prepared-tracks" data-pond-surface="tracks" data-active={tracksVisible}
        data-interactive={interactive === 'tracks'} aria-hidden={!tracksVisible}
        inert={interactive !== 'tracks'} onTransitionEnd={settleOnReveal}>
        <Suspense fallback={null}><PreparedTracks /></Suspense>
      </div>}
      {persistent && <div className="pond-prepared-artist" data-pond-surface="artist" data-active={artistVisible}
        data-interactive={interactive === 'artist'} aria-hidden={!artistVisible}
        inert={interactive !== 'artist'} onTransitionEnd={settleOnReveal}>
        <ArtistPondPage />
      </div>}
      {persistent && <div ref={routeRef} className="pond-route-surface" data-pond-surface={routeOwner} data-active={pageVisible}
        data-interactive={routeInteractive}
        data-archive-placeholder={stage === 'stable' && !pageVisible}
        aria-hidden={!pageVisible} inert={!routeInteractive} onTransitionEnd={settleOnReveal}>
        <Suspense fallback={null}>{children}</Suspense>
      </div>}
    </>
  );
}
