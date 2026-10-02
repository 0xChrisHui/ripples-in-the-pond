'use client';
import { useEffect, useState } from 'react';
import { usePlayer } from '../player/PlayerProvider';
import RecordAnchor from '../p11/RecordAnchor';
import { toPlayerTrack, originalAudioSources, originalCoverUrl, releaseOriginalPlayback } from '../../lib/music-catalog/player-adapter';
import type { OriginalTrack } from '../../lib/music-catalog/types';

export default function MaterialPlayer({ track }: { track: OriginalTrack }) {
  const player = usePlayer();
  const { getAudioElement, stop } = player;
  const [position, setPosition] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const current = player.currentTrack?.id === track.trackId;
  const playing = current && player.playing;
  useEffect(() => () => releaseOriginalPlayback(track.trackId, { getAudioElement, stop }),
    [getAudioElement, stop, track.trackId]);
  useEffect(() => {
    const audio = getAudioElement();
    if (!current || !audio) return;
    const update = () => setPosition(audio.currentTime);
    const unavailable = () => setError('永久音频网关暂不可用，点击唱片重试另一网关。');
    audio.addEventListener('timeupdate', update); audio.addEventListener('error', unavailable);
    return () => { audio.removeEventListener('timeupdate', update); audio.removeEventListener('error', unavailable); };
  }, [current, getAudioElement]);
  async function action() {
    const nextSource = error ? (sourceIndex + 1) % originalAudioSources(track.trackId).length : sourceIndex;
    setSourceIndex(nextSource); setError(null);
    if (error) player.stop();
    await player.toggle(toPlayerTrack(track.trackId, nextSource));
    const audio = player.getAudioElement();
    if (audio?.error) setError('永久音频网关暂不可用，点击唱片重试另一网关。');
  }
  const duration = current && Number.isFinite(player.duration) ? player.duration : 0;
  const shownPosition = current ? Math.min(position, duration) : 0;
  return <div className="material-player">
    <RecordAnchor title={track.title} coverUrl={originalCoverUrl(track.trackId)}
      state={error ? 'error' : playing ? 'playing' : 'idle'} onAction={() => { void action(); }}
      detailText="原曲试听 · 无需登录" />
    <label className="material-seek">播放进度
      <input aria-label="原曲播放进度" type="range" min={0} max={duration || 1} step="0.1"
        value={shownPosition} disabled={!current || !duration}
        onChange={(event) => { const value = Number(event.target.value); player.seek(value); setPosition(value); }} />
      <span>{Math.floor(shownPosition)} / {Math.floor(duration)} 秒</span>
    </label>
    {error && <p className="material-error" role="alert">{error}</p>}
  </div>;
}
