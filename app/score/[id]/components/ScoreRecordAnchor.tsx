'use client';

import RecordAnchor, { type RecordAnchorState } from '@/src/components/p11/RecordAnchor';
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
  const state = anchorState(playback);
  const progress = playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0;
  const perform = () => {
    if (playback.state === 'error') {
      window.location.reload();
      return;
    }
    if (playback.state === 'ended') void playback.replay();
    else void playback.toggle();
  };
  const detail = playback.state === 'error'
    ? `${playback.errorMessage ?? '永久播放资源暂不可用'}；身份与凭证仍可核验。`
    : playback.state === 'paused'
      ? `已暂停在 ${timeLabel(playback.positionMs)}`
      : playback.state === 'ended'
        ? `已完整播放 ${timeLabel(playback.durationMs)}`
        : playback.state === 'playing'
          ? '永久录音、日食与按键编舞保持同一时钟。'
          : '永久音频只会在你主动点击后建立播放会话。';
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
        playingActionLabel="暂停"
        detailText={detail}
        disabled={playback.state === 'loading'}
      />
      <div
        className="score-record-anchor__progress"
        role="progressbar"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, playback.durationMs)}
        aria-valuenow={playback.positionMs}
        aria-valuetext={`${timeLabel(playback.positionMs)} / ${timeLabel(playback.durationMs)}`}
      >
        <span style={{ transform: `scaleX(${Math.min(1, progress)})` }} />
      </div>
    </div>
  );
}
