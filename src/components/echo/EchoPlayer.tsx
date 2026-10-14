'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useServerText } from '@/src/i18n/use-server-text';
import PlaybackSeekBar from '@/src/components/common/PlaybackSeekBar';
import { useWalletRecipePlayer } from '@/src/features/wallet-recipe/player/use-wallet-recipe-player';
import type { WalletRecipeMetadataClipV1 } from '@/src/types/wallet-recipe';
import EchoRecipe from './EchoRecipe';

function timeLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// 状态文案在词典 echo.player.state.<state>

export default function EchoPlayer({ recipe, clips }: {
  recipe: string;
  clips: Record<string, WalletRecipeMetadataClipV1>;
}) {
  const t = useTranslations('echo.player');
  const serverText = useServerText();
  const input = useMemo(() => ({ recipe, clips }), [recipe, clips]);
  const player = useWalletRecipePlayer(input);
  const waiting = player.state === 'idle' || player.state === 'loading';

  async function primaryAction() {
    if (player.state === 'playing') return player.pause();
    if (player.state === 'paused') return player.resume();
    if (player.state === 'ended') return player.replay();
    if (player.state === 'error') return player.retryLoad();
    return player.play();
  }
  const action = t('action', { state: player.state });

  return (
    <section className="echo-player" data-state={player.state} aria-label={t('label')}>
      <div className="echo-player__pulse" aria-hidden="true">
        <span>{player.currentKey ?? recipe[0]}</span>
      </div>
      <div className="echo-player__body">
        <p className="echo-player__status" aria-live="polite">{t(`state.${player.state}`)}</p>
        <h2>{player.currentIndex == null ? t('start') : t('part', { index: player.currentIndex + 1 })}</h2>
        <p className="echo-player__loading">
          {waiting ? t('loaded', { loaded: player.loadedUniqueCount, total: player.totalUniqueCount }) : t('crossfade')}
        </p>
        <PlaybackSeekBar className="echo-player__track" value={player.positionMs}
          duration={player.durationMs} onSeek={player.seek} formatValue={timeLabel}
          disabled={waiting || player.state === 'error'} />
        <div className="echo-player__time">
          <time>{timeLabel(player.positionMs)}</time><time>{timeLabel(player.durationMs)}</time>
        </div>
        {player.errorMessage && <p className="echo-player__error" role="alert">{serverText(player.errorMessage, t('errorDefault'))}</p>}
        <button type="button" className="echo-player__action" onClick={() => { void primaryAction(); }}
          disabled={waiting}>{action}</button>
      </div>
      <EchoRecipe recipe={recipe} currentIndex={player.currentIndex} />
    </section>
  );
}
