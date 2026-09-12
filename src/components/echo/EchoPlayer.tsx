'use client';

import { useMemo } from 'react';
import { useWalletRecipePlayer } from '@/src/features/wallet-recipe/player/use-wallet-recipe-player';
import type { WalletRecipeMetadataClipV1 } from '@/src/types/wallet-recipe';
import EchoRecipe from './EchoRecipe';

function timeLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const STATE_LABEL = {
  idle: '等待永久音频', loading: '正在准备永久音频', ready: '可以播放',
  playing: '正在播放', paused: '已暂停', ended: '播放完成', error: '播放暂不可用',
} as const;

export default function EchoPlayer({ recipe, clips }: {
  recipe: string;
  clips: Record<string, WalletRecipeMetadataClipV1>;
}) {
  const input = useMemo(() => ({ recipe, clips }), [recipe, clips]);
  const player = useWalletRecipePlayer(input);
  const progress = player.durationMs > 0 ? player.positionMs / player.durationMs : 0;
  const waiting = player.state === 'idle' || player.state === 'loading';

  async function primaryAction() {
    if (player.state === 'playing') return player.pause();
    if (player.state === 'paused') return player.resume();
    if (player.state === 'ended') return player.replay();
    if (player.state === 'error') return player.retryLoad();
    return player.play();
  }
  const action = player.state === 'playing' ? '暂停'
    : player.state === 'paused' ? '继续'
      : player.state === 'ended' ? '重新播放'
        : player.state === 'error' ? '重新载入' : '播放完整作品';

  return (
    <section className="echo-player" data-state={player.state} aria-label="Pond Echo 永久播放器">
      <div className="echo-player__pulse" aria-hidden="true">
        <span>{player.currentKey ?? recipe[0]}</span>
      </div>
      <div className="echo-player__body">
        <p className="echo-player__status" aria-live="polite">{STATE_LABEL[player.state]}</p>
        <h2>{player.currentIndex == null ? '从第一圈涟漪开始' : `第 ${player.currentIndex + 1} / 36 段`}</h2>
        <p className="echo-player__loading">
          {waiting ? `已取得 ${player.loadedUniqueCount} / ${player.totalUniqueCount} 个唯一片段` : '60ms 等功率衔接 · 无自动播放'}
        </p>
        <div className="echo-player__track" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, progress)})` }} />
        </div>
        <div className="echo-player__time">
          <time>{timeLabel(player.positionMs)}</time><time>{timeLabel(player.durationMs)}</time>
        </div>
        {player.errorMessage && <p className="echo-player__error" role="alert">{player.errorMessage}</p>}
        <button type="button" className="echo-player__action" onClick={() => { void primaryAction(); }}
          disabled={waiting}>{action}</button>
      </div>
      <EchoRecipe recipe={recipe} currentIndex={player.currentIndex} />
    </section>
  );
}
