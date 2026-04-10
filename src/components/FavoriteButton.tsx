'use client';

import { useFavorite } from '@/src/hooks/useFavorite';

/**
 * 爱心收藏按钮
 * 点击即红（乐观更新），后端失败不回退，开发者从日志排查
 */
export default function FavoriteButton({
  tokenId,
  trackId,
  alreadyMinted = false,
  onMinted,
}: {
  tokenId: number;
  trackId: string;
  alreadyMinted?: boolean;
  onMinted?: (tokenId: number) => void;
}) {
  const { status, favorite } = useFavorite(tokenId, trackId, onMinted);

  if (alreadyMinted || status === 'success') {
    return (
      <span
        className="text-xl leading-none text-rose-400"
        aria-label="已收藏"
      >
        &#9829;
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={favorite}
      className="text-xl leading-none text-white/30 transition-all hover:scale-110 hover:text-rose-400"
      aria-label="收藏"
    >
      &#9825;
    </button>
  );
}
