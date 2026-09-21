import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { ScoreMintQueueRow, ScoreUploadState } from '@/src/types/jam';

/**
 * 链上 step 共用的 helper：解析 ScoreNFT mint receipt 拿 tokenId
 * Phase 6 A1 拆 steps-chain.ts 时分出来
 */

export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export type ReceiptLog = {
  address: string;
  topics: readonly `0x${string}`[];
};

/**
 * 从 mint tx receipt 的 logs 里抽 tokenId（topic[3] 是 to 地址，
 * 但 ERC721 Transfer 的第 4 个 topic 是 tokenId）。
 * 只信 SCORE_NFT_ADDRESS 出的 Transfer，避免 Orchestrator 内部其他 event 误匹配。
 */
export function extractTokenIdFromLogs(logs: readonly ReceiptLog[]): number {
  const matches = logs.filter(
    (l) =>
      l.topics.length >= 4 &&
      l.topics[0] === TRANSFER_TOPIC &&
      l.address.toLowerCase() === SCORE_NFT_ADDRESS.toLowerCase(),
  );
  if (matches.length === 0) {
    throw new Error('Transfer event not found in receipt');
  }
  return Number(BigInt(matches[0].topics[3]));
}

export type UploadKind = 'events' | 'package' | 'metadata';

type UploadColumns = Readonly<{
  tx: keyof ScoreMintQueueRow;
  sha: keyof ScoreMintQueueRow;
  bytes: keyof ScoreMintQueueRow;
  mime: keyof ScoreMintQueueRow;
  state: keyof ScoreMintQueueRow;
  verified: keyof ScoreMintQueueRow;
}>;

export const UPLOAD_COLUMNS: Record<UploadKind, UploadColumns> = {
  events: {
    tx: 'events_ar_tx_id', sha: 'events_sha256', bytes: 'events_bytes',
    mime: 'events_mime', state: 'events_upload_state', verified: 'events_verified_at',
  },
  package: {
    tx: 'package_ar_tx_id', sha: 'package_sha256', bytes: 'package_bytes',
    mime: 'package_mime', state: 'package_upload_state', verified: 'package_verified_at',
  },
  metadata: {
    tx: 'metadata_ar_tx_id', sha: 'metadata_sha256', bytes: 'metadata_bytes',
    mime: 'metadata_mime', state: 'metadata_upload_state', verified: 'metadata_verified_at',
  },
};

export async function writeUploadState(
  rowId: string,
  leaseOwner: string,
  kind: UploadKind,
  identity: { sha256: string; bytes: number; mime: string },
  state: Exclude<ScoreUploadState, 'none'>,
  txId?: string,
  error?: string,
): Promise<boolean> {
  const { data, error: rpcError } = await supabaseAdmin.rpc('write_score_upload_state', {
    p_queue_id: rowId,
    p_lease_owner: leaseOwner,
    p_kind: kind,
    p_content_sha256: identity.sha256,
    p_bytes: identity.bytes,
    p_mime: identity.mime,
    p_state: state,
    p_arweave_tx_id: txId ?? null,
    p_last_error: error?.slice(0, 2000) ?? null,
  });
  if (rpcError) throw new Error(`上传状态原子写入失败：${rpcError.message}`);
  return data === true;
}
