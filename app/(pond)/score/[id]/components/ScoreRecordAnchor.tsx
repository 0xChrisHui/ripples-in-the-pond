'use client';

import { useTranslations } from 'next-intl';
import RecordAnchor, { type RecordAnchorState } from '@/src/components/p11/RecordAnchor';
import { useServerText } from '@/src/i18n/use-server-text';
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
  const serverText = useServerText();
  const state = anchorState(playback);
  const perform = () => {
    if (playback.state === 'error') {
      window.location.reload();
      return;
    }
    if (playback.state === 'ended') void playback.replay();
    else void playback.toggle();
  };
  const detail = playback.state === 'error'
    ? t('errorDetail', { error: serverText(playback.errorMessage, t('errorDefault')) })
    : playback.state === 'paused'
      ? t('pausedAt', { time: timeLabel(playback.positionMs) })
      : playback.state === 'ended'
        ? t('playedFull', { time: timeLabel(playback.durationMs) })
        : playback.state === 'playing'
          ? t('playingDetail')
          : playback.state === 'loading'
            ? playback.playRequested
              ? t('queued')
              : t('preparing')
            : t('idle');
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
        loadingActionLabel={playback.playRequested ? t('cancelWait') : t('playWhenReady')}
        detailText={detail}
      />
      <PlaybackSeekBar
        className="score-record-anchor__progress"
        value={playback.positionMs}
        duration={playback.durationMs}
        onSeek={playback.seek}
        formatValue={timeLabel}
        disabled={playback.state === 'loading' || playback.state === 'error'}
      />
    </div>
  );
}
