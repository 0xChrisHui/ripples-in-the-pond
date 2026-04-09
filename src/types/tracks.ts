/**
 * 共享类型定义 — Track A / Track B 都用这套契约
 * 改这个文件前两条线必须对齐
 */

/** tracks 表的一行 */
export interface Track {
  id: string;
  title: string;
  /** 周数编号，1-108 */
  week: number;
  /** 音频文件路径（Phase 1 用 /tracks/xxx.mp3，Phase 2 换 Arweave） */
  audio_url: string;
  /** 封面颜色或图片 URL */
  cover: string;
  /** 所属岛屿/群组 */
  island: string;
  created_at: string;
}

/** mint_events 表的一行 */
export interface MintEvent {
  id: string;
  mint_queue_id: string;
  user_id: string;
  track_id: string;
  token_id: number;
  tx_hash: string;
  minted_at: string;
}

/** 个人页用：用户拥有的 NFT 概要 */
export interface OwnedNFT {
  track: Track;
  token_id: number;
  tx_hash: string;
  minted_at: string;
}

/** API 响应：GET /api/tracks/[id] */
export interface TrackDetailResponse {
  track: Track;
  /** 当前用户是否已铸造 */
  minted: boolean;
  /** 如果有 pending 的 mint 请求 */
  pending: boolean;
}

/** API 响应：GET /api/me/nfts */
export interface MyNFTsResponse {
  nfts: OwnedNFT[];
}
