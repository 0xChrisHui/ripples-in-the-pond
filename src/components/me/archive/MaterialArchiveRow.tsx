'use client';

import { useTranslations } from 'next-intl';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import type { OwnedNFT } from '@/src/types/tracks';

/** 收藏行本身就是播放按钮，不再增加第二个“试听”入口。 */
export default function MaterialArchiveRow({ nft }: { nft: OwnedNFT }) {
  const t = useTranslations('me.material');
  const { toggle, playing, currentTrack } = usePlayer();
  const track = nft.track ?? null;
  const isPlaying = Boolean(track && playing && currentTrack?.id === track.id);
  const title = track?.title ?? t('processing');

  return (
    <button type="button" className="me-archive-row me-archive-row--favorite"
      data-playing={isPlaying || undefined} disabled={!track}
      aria-label={t(isPlaying ? 'stopLabel' : 'playLabel', { title })}
      onClick={() => { if (track) void toggle(track); }}>
      <div className="me-archive-row__main"><h3>{title}</h3></div>
      <span className="me-archive-row__play">
        <span aria-hidden="true">{isPlaying ? '■' : '▶'}</span>
        {isPlaying ? t('stop') : track ? t('play') : t('pending')}
      </span>
    </button>
  );
}
