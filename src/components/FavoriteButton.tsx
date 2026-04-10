'use client';

import { useFavorite } from '@/src/hooks/useFavorite';

/**
 * 爱心收藏按钮 — 替代旧的 MintButton
 * 点击 → 未登录走登录 → 铸造 + 上传草稿
 * alreadyMinted = true 时初始就显示红心
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
  const { status, favorite, reset } = useFavorite(tokenId, trackId, onMinted);

  // 已铸造过或刚铸造成功 → 红心
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

  if (status === 'loading') {
    return (
      <span className="text-xl leading-none text-white/30 animate-pulse">
        &#9829;
      </span>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={() => { reset(); favorite(); }}
        className="text-xl leading-none text-red-400 transition-transform hover:scale-110"
        aria-label="收藏失败，点击重试"
        title="收藏失败，点击重试"
      >
        &#9829;
      </button>
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
