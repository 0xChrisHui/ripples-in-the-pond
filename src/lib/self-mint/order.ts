import 'server-only';

import { getAddress, type Address, type Hex } from 'viem';
import type { SelfMintStatus } from '@/src/types/self-mint';

export type SelfMintOrderRow = {
  id: string;
  order_id: Hex;
  claim_version: number;
  user_id: string;
  pending_score_id: string;
  track_id: string;
  chain_id: 1 | 11155111;
  score_contract: Address;
  token_id: number;
  recipient_address: Address;
  cover_ar_tx_id: string;
  sound_set_id: string;
  sounds_map_ar_tx_id: string;
  sounds_map_sha256: string;
  sounds_map_bytes: number;
  sounds_map_mime: 'application/json';
  decoder_id: string;
  decoder_ar_tx_id: string;
  decoder_sha256: string;
  decoder_bytes: number;
  decoder_mime: 'text/html';
  base_ar_tx_id: string;
  base_sha256: string;
  base_bytes: number;
  base_mime: 'audio/mpeg';
  requires_package_v3: true;
  events_ar_tx_id: string | null;
  events_sha256: string | null;
  events_bytes: number | null;
  events_mime: 'application/json' | null;
  events_upload_state: UploadState;
  package_ar_tx_id: string | null;
  package_sha256: string | null;
  package_bytes: number | null;
  package_mime: 'application/json' | null;
  package_upload_state: UploadState;
  metadata_ar_tx_id: string | null;
  metadata_sha256: string | null;
  metadata_bytes: number | null;
  metadata_mime: 'application/json' | null;
  metadata_upload_state: UploadState;
  token_uri: string | null;
  typed_data_digest: Hex | null;
  uri_hash: Hex | null;
  voucher_deadline: number | null;
  authorizer_address: Address | null;
  send_attempted_at: string | null;
  tx_hash: Hex | null;
  failed_tx_hash: Hex | null;
  replacement_tx_hash: Hex | null;
  block_number: number | null;
  confirmed_at: string | null;
  status: SelfMintStatus;
  retryable: boolean;
  retry_count: number;
  failure_code: string | null;
  last_error: string | null;
  locked_by: string | null;
  lease_expires_at: string | null;
  created_at: string;
};

export type UploadState = 'none' | 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';

function assetStage(row: SelfMintOrderRow): 'events' | 'package' | 'metadata' | 'complete' {
  if (row.events_upload_state !== 'verified') return 'events';
  if (row.package_upload_state !== 'verified') return 'package';
  if (row.metadata_upload_state !== 'verified') return 'metadata';
  return 'complete';
}

export function publicOrder(row: SelfMintOrderRow) {
  return {
    orderId: row.order_id,
    pendingScoreId: row.pending_score_id,
    chainId: row.chain_id,
    scoreContract: getAddress(row.score_contract),
    tokenId: String(row.token_id),
    recipientAddress: getAddress(row.recipient_address),
    tokenUri: row.token_uri,
    txHash: row.tx_hash,
    failedTxHash: row.failed_tx_hash,
    replacementTxHash: row.replacement_tx_hash,
    blockNumber: row.block_number == null ? null : String(row.block_number),
    confirmedAt: row.confirmed_at,
    status: row.status,
    retryable: row.retryable,
    failureCode: row.failure_code,
    authorizationDigest: row.typed_data_digest,
    sendAttempted: row.send_attempted_at !== null,
    assetStage: assetStage(row),
  };
}
