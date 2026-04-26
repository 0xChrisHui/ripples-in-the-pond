/**
 * NFT 本地缓存 — 秒开用
 * tokenId 列表给首页爱心，完整 NFT 列表给 /me 页
 *
 * Phase 6 B1：所有 key 按 userId 隔离，未登录用 _anon 后缀
 * 切换账号时由 useAuth.logout 调 clearNftCache(prevUserId) 清当前用户缓存
 */

import type { OwnedNFT } from '@/src/types/tracks';

const IDS_PREFIX = 'ripples_minted_token_ids';
const NFTS_PREFIX = 'ripples_cached_nfts';

type UserId = string | null | undefined;

function idsKey(userId: UserId): string {
  return userId ? `${IDS_PREFIX}_${userId}` : `${IDS_PREFIX}_anon`;
}

function nftsKey(userId: UserId): string {
  return userId ? `${NFTS_PREFIX}_${userId}` : `${NFTS_PREFIX}_anon`;
}

export function getCachedMintedIds(userId: UserId): number[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(idsKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setCachedMintedIds(userId: UserId, ids: number[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(idsKey(userId), JSON.stringify(ids));
}

export function addCachedMintedId(userId: UserId, id: number): void {
  const ids = getCachedMintedIds(userId);
  if (!ids.includes(id)) {
    ids.push(id);
    setCachedMintedIds(userId, ids);
  }
}

export function getCachedNFTs(userId: UserId): OwnedNFT[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(nftsKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setCachedNFTs(userId: UserId, nfts: OwnedNFT[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(nftsKey(userId), JSON.stringify(nfts));
}

/// 登出时调用，清当前用户两个 cache key
export function clearNftCache(userId: UserId): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(idsKey(userId));
  localStorage.removeItem(nftsKey(userId));
}
