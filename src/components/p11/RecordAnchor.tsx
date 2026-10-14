'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

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
  allowBusyAction?: boolean;
  loadingActionLabel?: string;
};

// 各状态的动作与说明文案在词典 record.state.<state>

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
  playingActionLabel,
  allowBusyAction = false,
  loadingActionLabel,
}: Props) {
  const t = useTranslations('record');
  const statusId = useId();
  const copy = { action: t(`state.${state}.action`), status: t(`state.${state}.status`) };
  const isPlaying = state === 'playing';
  const isBusy = state === 'loading';
  const actionDisabled = disabled || (isBusy && !allowBusyAction);
  const showsEclipse = isPlaying && eclipseVisual != null;
  const actionLabel = isPlaying ? playingActionLabel ?? t('state.playing.action')
    : isBusy ? loadingActionLabel ?? t('state.loading.action') : copy.action;

  return (
    <section
      className="record-anchor"
      data-state={state}
      data-visual={showsEclipse ? 'eclipse' : 'record'}
      aria-label={t('controls', { title })}
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
