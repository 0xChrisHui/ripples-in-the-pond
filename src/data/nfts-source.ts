import type { OwnedNFT, MyNFTsResponse } from '@/src/types/tracks';
import { fetchWithAuth } from '@/src/lib/fetch-with-auth';

/**
 * 数据适配层 — 个人页 NFT 数据
 * Track C：从真实 API 读取（需要 auth token）
 */
export async function fetchMyNFTs(token: string): Promise<OwnedNFT[]> {
  const res = await fetchWithAuth('/api/me/nfts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data: MyNFTsResponse = await res.json();
  return data.nfts;
}
