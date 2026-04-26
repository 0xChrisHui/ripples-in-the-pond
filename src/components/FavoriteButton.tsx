'use client';

import { useFavorite } from '@/src/hooks/useFavorite';

/**
 * 爱心收藏按钮 — 乐观更新（Phase 6 G0 用户决策：失败由 ops 兜底）
 *   idle    ♡ 空心（可点）
 *   success ♥ 红心（点击立即变红，永远红，失败也不回退）
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
      <span className="text-xl leading-none text-rose-400" aria-label="已收藏">
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
