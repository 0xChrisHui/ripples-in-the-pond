/** ScoreNFT 铸造队列的上传结果状态；unknown 必须人工对账，禁止盲重传。 */
import type { SelfMintStatus } from './self-mint';

export type ScoreUploadState =
  | 'none'
  | 'uploading'
  | 'uploaded'
  | 'verified'
  | 'upload_result_unknown';

/** score_nft_queue 状态机的单一 TypeScript 来源。 */
export const SCORE_STATUSES = [
  'pending',
  'uploading_events',
  'preparing_package',
  'minting_onchain',
  'uploading_metadata',
  'setting_uri',
  'finalizing_snapshot',
  'success',
  'failed',
] as const;

export type ScoreMintStatus = (typeof SCORE_STATUSES)[number];
export type ScoreFailureKind = 'safe_retry' | 'manual_review';

export type ScorePackagePreview = {
  ref: `ar://${string}`;
  sha256: string;
  bytes: number;
  mime: 'application/json';
};

/** 非终态：用于积压、卡龄与健康检查。 */
export const SCORE_ACTIVE_STATUSES = SCORE_STATUSES.filter(
  (status) => status !== 'success' && status !== 'failed',
);

/** score_nft_queue 表的一行；永久资源列对历史行保持 nullable。 */
export interface ScoreMintQueueRow {
  id: string;
  user_id: string;
  pending_score_id: string;
  track_id: string;
  cover_ar_tx_id: string;
  events_ar_tx_id: string | null;
  metadata_ar_tx_id: string | null;
  token_id: number | null;
  token_uri: string | null;
  status: ScoreMintStatus;
  retry_count: number;
  last_error: string | null;
  tx_hash: string | null;
  uri_tx_hash: string | null;
  locked_by: string | null;
  lease_expires_at: string | null;
  mint_attempted_at: string | null;
  uri_attempted_at: string | null;
  sound_set_id: string | null;
  sounds_map_ar_tx_id: string | null;
  sounds_map_sha256: string | null;
  sounds_map_bytes: number | null;
  sounds_map_mime: string | null;
  decoder_id: string | null;
  decoder_ar_tx_id: string | null;
  decoder_sha256: string | null;
  decoder_bytes: number | null;
  decoder_mime: string | null;
  base_ar_tx_id: string | null;
  base_sha256: string | null;
  base_bytes: number | null;
  base_mime: string | null;
  requires_package_v3: boolean;
  events_sha256: string | null;
  events_bytes: number | null;
  events_mime: string | null;
  events_upload_state: ScoreUploadState;
  events_verified_at: string | null;
  package_ar_tx_id: string | null;
  package_sha256: string | null;
  package_bytes: number | null;
  package_mime: string | null;
  package_upload_state: ScoreUploadState;
  package_verified_at: string | null;
  metadata_sha256: string | null;
  metadata_bytes: number | null;
  metadata_mime: string | null;
  metadata_upload_state: ScoreUploadState;
  metadata_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** OpenSea ERC-721 metadata 标准。 */
export interface ScoreMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  animation_url: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  properties?: {
    playback: {
      schema: 'ripples.score-package.v3';
      package: `ar://${string}`;
      sha256: string;
      bytes: number;
      mime: 'application/json';
    };
  };
}

/** 个人页的 Score 队列记录；状态直接来自数据库。 */
export interface OwnedScoreNFT {
  id: string;
  queueId: string;
  tokenId?: number;
  status: ScoreMintStatus | SelfMintStatus;
  trackTitle: string;
  eventCount: number | null;
  txHash?: string;
  failureKind: ScoreFailureKind | null;
  submittedAt: string;
  scorePackage?: ScorePackagePreview;
  mintMode?: 'op_sponsored' | 'eth_self_paid';
  chainId?: number;
  contractAddress?: string;
  orderId?: string;
  recipientAddress?: string;
}

export interface MyScoreNFTsResponse {
  scoreNfts: OwnedScoreNFT[];
}

export interface MintScoreRequest {
  pendingScoreId: string;
}

export interface MintScoreResponse {
  queueId: string;
  coverArTxId: string;
  coverUrl: string;
}
