import type { OwnedNFT } from '@/src/types/tracks';
import { MOCK_NFTS } from './mock-nfts';

/**
 * 数据适配层 — 个人页 NFT 数据
 * Track B（当前）：返回假数据
 * Track C 替换为：fetch('/api/me/nfts').then(r => r.json())
 */
export async function fetchMyNFTs(): Promise<OwnedNFT[]> {
  return MOCK_NFTS;
}
