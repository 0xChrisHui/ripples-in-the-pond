/**
 * NFT 本地缓存 — 秒开用
 * tokenId 列表给首页爱心，完整 NFT 列表给 /me 页
 */

import type { OwnedNFT } from '@/src/types/tracks';

const IDS_KEY = 'ripples_minted_token_ids';
const NFTS_KEY = 'ripples_cached_nfts';

export function getCachedMintedIds(): number[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(IDS_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export function setCachedMintedIds(ids: number[]): void {
  localStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

export function addCachedMintedId(id: number): void {
  const ids = getCachedMintedIds();
  if (!ids.includes(id)) {
    ids.push(id);
    setCachedMintedIds(ids);
  }
}

export function getCachedNFTs(): OwnedNFT[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(NFTS_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export function setCachedNFTs(nfts: OwnedNFT[]): void {
  localStorage.setItem(NFTS_KEY, JSON.stringify(nfts));
}
