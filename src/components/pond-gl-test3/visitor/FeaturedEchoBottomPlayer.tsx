'use client';

import { useTranslations } from 'next-intl';
import type { FeaturedEcho } from '@/src/types/featured-echo';
import { useServerText } from '@/src/i18n/use-server-text';
import type { FeaturedEchoPlayback } from './useFeaturedEchoPlayback';

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Pond Echo 专用控制条；它不是 Material Track，因此永远不显示收藏。 */
export default function FeaturedEchoBottomPlayer({
  echo,
  playback,
}: {
  echo: FeaturedEcho | null;
  playback: FeaturedEchoPlayback;
}) {
  const t = useTranslations('player');
  const tc = useTranslations('common');
  const serverText = useServerText();
  if (!echo || playback.state === 'idle') return null;
  const action = t('echoAction', { state: playback.state });
  return (
    <aside className="bottom-player-shell" data-playing={playback.playing}
      data-featured-echo-player={playback.state} aria-label={t('echoPlayer')}>
      <div className="bottom-player">
        <div className="bottom-player__progress" role="progressbar" aria-label={tc('playbackProgress')}
          aria-valuemin={0} aria-valuemax={Math.max(1, playback.durationMs)}
          aria-valuenow={Math.round(playback.positionMs)}>
          <span style={{ transform: `scaleX(${Math.min(1, playback.progress)})` }} />
        </div>
        <div className="bottom-player__body">
          <span className="bottom-player__record" aria-hidden="true"><span /></span>
          <div className="bottom-player__identity">
            <p title={echo.title}>{echo.title}</p>
            <span>{formatTime(playback.positionMs)} <i aria-hidden="true">/</i> {formatTime(playback.durationMs)}</span>
            {playback.errorMessage && <span role="alert">{serverText(playback.errorMessage, t('playbackFailed'))}</span>}
          </div>
          <div className="bottom-player__actions">
            <button type="button" onClick={() => { void playback.toggle(); }}>{action}</button>
            <button type="button" onClick={playback.stop} aria-label={t('stopTitle', { title: echo.title })}>{t('stop')}</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
