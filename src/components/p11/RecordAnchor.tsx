'use client';

import { useId, type ReactNode } from 'react';

export type RecordAnchorState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

type Props = {
  state: RecordAnchorState;
  title: string;
  coverUrl: string;
  onAction: () => void;
  eclipseVisual?: ReactNode;
  statusText?: string;
  detailText?: string;
  disabled?: boolean;
  playingActionLabel?: string;
};

const stateCopy: Record<RecordAnchorState, { action: string; status: string }> = {
  idle: { action: '开始播放', status: '点击唱片，开始播放' },
  loading: { action: '正在准备', status: '正在准备永久录音…' },
  playing: { action: '停止', status: '正在播放' },
  paused: { action: '继续播放', status: '播放已暂停' },
  ended: { action: '再次播放', status: '播放已结束' },
  error: { action: '重试', status: '播放暂不可用' },
};

/** 父组件掌管播放状态；唱片与日食始终调用同一个主动作。 */
export default function RecordAnchor({
  state,
  title,
  coverUrl,
  onAction,
  eclipseVisual,
  statusText,
  detailText,
  disabled = false,
  playingActionLabel = '停止',
}: Props) {
  const statusId = useId();
  const copy = stateCopy[state];
  const isPlaying = state === 'playing';
  const isBusy = state === 'loading';
  const actionDisabled = disabled || isBusy;
  const showsEclipse = isPlaying && eclipseVisual != null;
  const actionLabel = isPlaying ? playingActionLabel : copy.action;

  return (
    <section
      className="record-anchor"
      data-state={state}
      data-visual={showsEclipse ? 'eclipse' : 'record'}
      aria-label={`${title} 播放控制`}
    >
      <button
        className="record-anchor__visual"
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        aria-describedby={statusId}
        aria-label={`${actionLabel}《${title}》`}
        aria-pressed={isPlaying}
        aria-busy={isBusy}
      >
        <span className="record-anchor__record" aria-hidden="true">
          <span className="record-anchor__grooves" />
          <span
            className="record-anchor__label"
            style={{ backgroundImage: `url("${coverUrl}")` }}
          />
          <span className="record-anchor__spindle" />
        </span>
        <span className="record-anchor__eclipse" aria-hidden="true">
          {eclipseVisual}
        </span>
      </button>

      <div className="record-anchor__caption" id={statusId} aria-live="polite">
        <p>{statusText ?? copy.status}</p>
        {detailText && <small>{detailText}</small>}
      </div>

      <button
        className="record-anchor__action"
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        aria-label={`${actionLabel}《${title}》`}
        aria-pressed={isPlaying}
        aria-busy={isBusy}
      >
        {actionLabel}
      </button>
    </section>
  );
}
