'use client';
import { useEffect, useMemo, useRef } from 'react';
import PlaybackSeekBar from '../common/PlaybackSeekBar';
import type { OriginalTrack } from '../../lib/music-catalog/types';
import { getTrackImprint } from '../../lib/music-catalog/experience/imprints';
import SoundImprint from './listening/SoundImprint';
import { useOriginalPlayback } from './listening/useOriginalPlayback';
import TrackCircle from './listening/circle/TrackCircle';
import MaterialNoticeView from './claim/MaterialNoticeView';

export function formatTrackTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

export default function MaterialPlayer({ track, onControlsVisible, visual = 'imprint' }: {
  track: OriginalTrack; onControlsVisible?: (visible: boolean) => void; visual?: 'imprint' | 'circle';
}) {
  const playback = useOriginalPlayback(track);
  const controls = useRef<HTMLDivElement>(null);
  const imprint = useMemo(() => getTrackImprint(track.trackId), [track.trackId]);
  const { phase, duration, position } = playback;
  const active = phase === 'playing' || phase === 'preparing';
  useEffect(() => {
    const element = controls.current;
    if (!element || !onControlsVisible) return;
    const observer = new IntersectionObserver(([entry]) => onControlsVisible(entry.intersectionRatio >= .5), { threshold: [.5] });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onControlsVisible]);
  const labels = { idle: '开始聆听', preparing: '取消准备', playing: '停止聆听', ended: '再听一次', error: '重新聆听' };
  return <div className="material-player" data-phase={phase} data-playing={phase === 'playing'}
    data-track-motion={visual === 'circle' ? 'circle' : 'sound'} data-track-edition={String(track.displayNumber).padStart(2, '0')}>
    {visual === 'circle' ? <TrackCircle track={track} phase={phase} onAction={() => { void playback.action(); }} />
      : imprint && <SoundImprint imprint={imprint} trackId={track.trackId} phase={phase}
        progress={duration > 0 ? position / duration : 0} />}
    <div className="material-player__controls" ref={controls}>
      <div className="material-player__action-row">
        <button className="material-player__action" type="button" onClick={() => { void playback.action(); }}>
          <span className="material-player__action-symbol" aria-hidden="true">
            {active ? <i className="material-player__stop" /> : <i className="material-player__play" />}
          </span><span>{labels[phase]}</span>
        </button>
        <span className="material-player__status" role="status">
          {phase === 'preparing' ? '音频正在准备' : phase === 'playing' ? '正在播放' : phase === 'ended' ? '聆听结束' : ''}
        </span>
      </div>
      <div className="material-seek">
        <span>{formatTrackTime(position)}</span>
        <PlaybackSeekBar value={position * 1000} duration={duration * 1000}
          onSeek={(value) => playback.seek(value / 1000)} formatValue={(value) => formatTrackTime(value / 1000)}
          disabled={phase !== 'playing'} label={`原曲 ${track.title} 播放进度`} />
        <span>{formatTrackTime(duration)}</span>
      </div>
      {phase === 'error' && <MaterialNoticeView notice={{ tone: 'error', title: '音频暂时未能载入', hint: '请点击“重新聆听”再试一次。' }} />}
    </div>
  </div>;
}
