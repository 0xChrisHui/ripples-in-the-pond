import type { OwnedNFT } from '@/src/types/tracks';
import { MOCK_TRACKS } from './mock-tracks';

/**
 * 假 NFT 数据 — 模拟用户已铸造的 2 张 NFT
 * Track C 集成后这个文件不再被 import
 */
export const MOCK_NFTS: OwnedNFT[] = [
  {
    track: MOCK_TRACKS[0],
    token_id: 1,
    tx_hash: '0xabc123...mock',
    minted_at: '2026-01-10',
  },
  {
    track: MOCK_TRACKS[2],
    token_id: 3,
    tx_hash: '0xdef456...mock',
    minted_at: '2026-01-25',
  },
];
