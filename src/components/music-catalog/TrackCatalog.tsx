'use client';
import PondRouteLink from '../pond-shell/PondRouteLink';
import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../player/PlayerProvider';
import { getMusicCatalog } from '../../lib/music-catalog/asset-registry';
import MaterialPlayer from './MaterialPlayer';
import MaterialProvenance from './MaterialProvenance';
import MaterialMintPanel from './claim/MaterialMintPanel';
import TrackIndex from './TrackIndex';
import PageNavigation from '../pond-shell/navigation/PageNavigation';
import { usePondTransition } from '../pond-shell/pond-transition';
import { releaseOriginalPlayback, toPlayerTrack } from '../../lib/music-catalog/player-adapter';
import { clearTrackWarmup, warmTrackAudio } from '../player/track-preload';

export default function TrackCatalog({ initialTrackId, single = false, appearance = single ? 'archive' : 'pond' }: {
  initialTrackId?: string; single?: boolean; appearance?: 'archive' | 'pond';
}) {
  const catalog = useMemo(() => getMusicCatalog(), []);
  const tracks = useMemo(() => [...catalog.tracks].sort((a, b) => a.displayNumber - b.displayNumber), [catalog]);
  const [selectedId, setSelectedId] = useState(initialTrackId ?? tracks[0].trackId);
  const [controlsVisible, setControlsVisible] = useState(true);
  const player = usePlayer();
  const transition = usePondTransition();
  const active = !transition || transition.transaction.interactiveOwner === 'tracks';
  const selected = tracks.find((track) => track.trackId === selectedId) ?? tracks[0];
  function select(id: string) {
    if (id === selectedId) return;
    const continuePlaying = player.playing && player.currentTrack?.id === selectedId;
    if (continuePlaying) void player.toggle(toPlayerTrack(id));
    else if (player.currentTrack) player.stop();
    setSelectedId(id);
    // 地址栏同步当前曲目，便于分享；只在本页处于前台、且不是单曲页时改写。
    const next = tracks.find((track) => track.trackId === id);
    if (next && !single && active) {
      const url = new URL(window.location.href); url.searchParams.set('track', String(next.displayNumber));
      window.history.replaceState(window.history.state, '', url);
    }
  }
  const index = tracks.findIndex((track) => track.trackId === selectedId);
  const { prepare, getAudioElement } = player;
  useEffect(() => {
    if (!initialTrackId) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setSelectedId(initialTrackId); });
    return () => { cancelled = true; };
  }, [initialTrackId]);
  useEffect(() => {
    if (!active) releaseOriginalPlayback(selectedId, { getAudioElement, stop: player.stop });
  }, [active, getAudioElement, player.stop, selectedId]);
  useEffect(() => {
    if (!active) return;
    prepare(toPlayerTrack(selectedId));
    const audio = getAudioElement();
    const warmNeighbours = () => {
      for (const neighbour of [tracks[index - 1], tracks[index + 1]]) {
        if (neighbour) warmTrackAudio(toPlayerTrack(neighbour.trackId));
      }
    };
    if (audio && audio.readyState >= audio.HAVE_FUTURE_DATA) warmNeighbours();
    else audio?.addEventListener('canplay', warmNeighbours, { once: true });
    return () => audio?.removeEventListener('canplay', warmNeighbours);
  }, [active, getAudioElement, index, prepare, selectedId, tracks]);
  useEffect(() => clearTrackWarmup, []);
  const number = String(selected.displayNumber).padStart(2, '0');
  const note = selected.notes.text?.trim() ?? '';
  const paragraphs = note.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  // 只摘取作者第一段的完整句子；完整手记保持原文和换行。
  const opening = paragraphs[0] ?? '';
  const excerpt = opening.length > 60 ? opening.match(/^.{1,90}?[。！？]/su)?.[0] ?? opening : opening;
  const nextTrack = tracks[index + 1] ?? tracks[0];
  function selectAndReturn(id: string) {
    select(id);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  return (
    <main className={`material-catalog track-archive ${single ? 'track-archive--single' : ''} ${appearance === 'pond' ? 'track-archive--pond' : ''}`}
      data-track-surface={appearance} data-pond-focus-entry={appearance === 'pond' ? 'tracks' : undefined} tabIndex={-1}
      data-revision={catalog.revision} data-selected-track={selected.title}
      data-controls-visible={controlsVisible && player.currentTrack?.id === selected.trackId}>
      <PageNavigation />
      <div className="pond-global-header-spacer" />
      {single && <nav className="track-asset-navigation" aria-label="曲目目录"><PondRouteLink href="/tracks">全部曲目 →</PondRouteLink></nav>}
      <section className="track-stage" data-track-stage="true" aria-labelledby="track-title">
        {!single && <TrackIndex tracks={tracks} selectedId={selectedId} onSelect={select}
          onPrepare={(id) => warmTrackAudio(toPlayerTrack(id))} />}
        <article className="track-stage__focus" key={appearance === 'pond' ? 'pond' : selected.trackId}>
          <header className="track-stage__title">
            <h1 id="track-title" aria-label={`原曲 ${selected.title}`}><span>原曲</span><strong>{number}</strong></h1>
            {excerpt ? <blockquote>{excerpt}</blockquote>
              : <p className="track-stage__pending">创作手记整理中，作者会在之后补充。</p>}
            <div className="track-stage__links">
              {excerpt && <a className="track-stage__read" href="#track-story">阅读创作手记 <span aria-hidden="true">↘</span></a>}
              <a className="track-stage__read" href="#track-collect">收藏这首原曲 <span aria-hidden="true">↘</span></a>
            </div>
          </header>
          <div className="track-stage__player" data-track-playback="primary">
            <MaterialPlayer track={selected} onControlsVisible={setControlsVisible} visual={appearance === 'pond' ? 'circle' : 'imprint'} />
          </div>
          {!single && <nav className="track-switcher" aria-label="相邻曲目">
            <button type="button" disabled={index === 0} onClick={() => select(tracks[index - 1].trackId)}>
              <span aria-hidden="true">←</span> 上一首
            </button>
            <span>{number} / {tracks.length}</span>
            <button type="button" disabled={index === tracks.length - 1}
              onClick={() => select(tracks[index + 1].trackId)}>下一首 <span aria-hidden="true">→</span></button>
          </nav>}
        </article>
      </section>
      <div className="track-reading" data-pond-no-ripple="true">
      {paragraphs.length > 0 && <section className="track-story" id="track-story" aria-label={`原曲 ${selected.title} 创作手记`}>
        <div className="track-story__body">
          <div className="track-story__copy">
            {paragraphs.map((paragraph, paragraphIndex) => <p key={`${selected.trackId}-${paragraphIndex}`}>{paragraph}</p>)}
          </div>
        </div>
      </section>}
      <div className="track-ledger"><MaterialMintPanel track={selected} /><MaterialProvenance track={selected} /></div>
      <footer className="track-story__next">
        {single ? <PondRouteLink href="/tracks"><small>返回目录</small><strong>全部曲目</strong><b aria-hidden="true">→</b></PondRouteLink>
          : <button type="button" onClick={() => selectAndReturn(nextTrack.trackId)}>
            <small>下一首</small><strong>原曲 {nextTrack.title}</strong><b aria-hidden="true">→</b>
          </button>}
      </footer>
      </div>
    </main>
  );
}
