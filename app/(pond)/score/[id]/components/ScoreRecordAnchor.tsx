'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import RecordAnchor, { type RecordAnchorState } from '@/src/components/p11/RecordAnchor';
import { playbackStatusKey } from './hero/playback-status';
import PlaybackSeekBar from '@/src/components/common/PlaybackSeekBar';
import type { UseScorePlaybackResult } from '@/src/features/score-playback/types';

type Props = {
  title: string;
  coverUrl: string;
  playback: UseScorePlaybackResult;
  eclipseAvailable: boolean;
};

function anchorState(playback: UseScorePlaybackResult): RecordAnchorState {
  if (playback.state === 'ready') return 'idle';
  return playback.state;
}

function timeLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function ScoreRecordAnchor({ title, coverUrl, playback, eclipseAvailable }: Props) {
  const t = useTranslations('score.playback');
  const router = useRouter();
  const state = anchorState(playback);
  const perform = () => {
    if (playback.state === 'error') {
      router.refresh();
      return;
    }
    if (playback.state === 'ended') void playback.replay();
    else void playback.toggle();
  };
  const hintKey = playbackStatusKey(playback.state, playback.playRequested);
  const eclipse = eclipseAvailable
    ? <span className="score-eclipse-viewport-anchor" />
    : <span className="score-eclipse-fallback" />;

  return (
    <div className="score-record-anchor" data-playback-state={playback.state}>
      <RecordAnchor
        state={state}
        title={title}
        coverUrl={coverUrl}
        onAction={perform}
        eclipseVisual={eclipse}
        playingActionLabel={t('pause')}
        allowBusyAction
        compact
        loadingActionLabel={playback.playRequested ? t('cancelWait') : t('playWhenReady')}
      />
      <div className="score-record-anchor__bar">
      <button type="button" className="score-record-anchor__toggle" onClick={perform}
        aria-label={playback.state === 'playing' ? t('pause') : playback.playRequested ? t('cancelWait') : t('playWhenReady')} aria-pressed={playback.state === 'playing'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={playback.state === 'playing' ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M8 4.5v15l12-7.5z'} /></svg>
      </button>
      <span>{timeLabel(playback.positionMs)}</span>
      <PlaybackSeekBar
        className="score-record-anchor__progress"
        value={playback.positionMs}
        duration={playback.durationMs}
        onSeek={playback.seek}
        formatValue={timeLabel}
        disabled={playback.state === 'loading' || playback.state === 'error'}
      />
      <span>{timeLabel(playback.durationMs)}</span>
      </div>
      <p className="score-record-anchor__hint" aria-live="polite">{hintKey ? t(hintKey) : '\u00a0'}</p>
    </div>
  );
}
