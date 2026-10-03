'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePlayer } from '../player/PlayerProvider';
import { getMusicCatalog } from '../../lib/music-catalog/asset-registry';
import MaterialPlayer from './MaterialPlayer';
import MaterialProvenance from './MaterialProvenance';
import MaterialMintPanel from './MaterialMintPanel';

export default function TrackCatalog({ initialTrackId, single = false }: { initialTrackId?: string; single?: boolean }) {
  const catalog = getMusicCatalog();
  const tracks = [...catalog.tracks].sort((a, b) => a.displayNumber - b.displayNumber);
  const [selectedId, setSelectedId] = useState(initialTrackId ?? tracks[0].trackId);
  const player = usePlayer();
  const selected = tracks.find((track) => track.trackId === selectedId) ?? tracks[0];
  function select(id: string) {
    if (id === selectedId) return;
    if (player.currentTrack) player.stop();
    setSelectedId(id);
  }
  const index = tracks.findIndex((track) => track.trackId === selectedId);
  return <main className="material-catalog" data-revision={catalog.revision}>
    <header className="material-header"><Link href="/">← 返回水塘</Link><span>RIPPLES IN THE POND</span>
      {single && <Link href="/tracks">全部曲目 →</Link>}</header>
    <div className="material-intro"><p>ORIGINAL RECORDINGS / 35</p><h1>{single ? '原曲唱片' : '曲目'}</h1>
      <p>选择一首，留一点时间给声音。</p></div>
    <div className={`material-grid ${single ? 'material-grid--single' : ''}`}>
      {!single && <nav className="material-track-list" aria-label="35 首原曲目录">
        {tracks.map((track) => <button key={track.trackId} type="button" onClick={() => select(track.trackId)}
          aria-pressed={track.trackId === selectedId}><span>{String(track.displayNumber).padStart(2, '0')}</span>
          <span>原曲 {track.title}</span><span aria-hidden="true">{track.trackId === selectedId ? '●' : '○'}</span></button>)}
      </nav>}
      <article className="material-detail" key={selected.trackId}>
        <div className="material-title"><p>NO. {String(selected.displayNumber).padStart(2, '0')}</p><h2>原曲 {selected.title}</h2></div>
        <MaterialPlayer track={selected} />
        {!single && <div className="material-adjacent"><button type="button" disabled={index === 0}
          onClick={() => select(tracks[index - 1].trackId)}>← 上一首</button><button type="button" disabled={index === 34}
          onClick={() => select(tracks[index + 1].trackId)}>下一首 →</button></div>}
        <section className="material-notes"><h3>创作手记</h3><p>{selected.notes.text ?? '艺术家尚未提供创作手记。'}</p></section>
        <MaterialMintPanel track={selected} /><MaterialProvenance track={selected} />
      </article>
    </div><footer className="material-footer">35 首原曲 · 永久音频来源 · 创作手记</footer>
  </main>;
}
